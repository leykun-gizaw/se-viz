"""SE-Viz Python recorder (Phase 29 spike; streaming and the size budget from Phase 31).

Runs a student's program under ``sys.settrace`` and records one JSON snapshot per traced event
(``call``, ``line``, ``return``, ``exception``) in **user code only**: the source is compiled with
the filename ``"<student>"`` and every other frame (stdlib, packages, this file) is ignored.

The shape of what ``run_json`` returns is documented in ``docs/PYTHON_TRACE_FORMAT.md`` ("Raw
recorder snapshot"). Everything here is plain Python with no third-party imports, so it runs the
same in a browser worker and in Node (the unit tests).

Object identity: every object the recorder sees is kept alive in ``self.keep`` until the run ends,
so CPython never reuses its ``id()``; raw ids are mapped to ``o1``, ``o2``, ... in first-seen order.
Frames get ``f1``, ``f2``, ... the same way (one id per activation).
"""

import ast as _ast
import builtins as _builtins
import dis as _dis
import json as _json
import linecache as _linecache
import sys as _sys
import time as _time
import traceback as _traceback
import types as _types

FILENAME = "<student>"
REPR_CAP = 80
STDOUT_MAX_CHARS = 64 * 1024
# The real interpreter recursion limit sits this far above the user-frame cap, so the recorder's own
# frames (trace callback, snapshot) always have room and the cap below is what the student hits.
RECURSION_HEADROOM = 100

PRIMITIVES = {
    int: "int",
    float: "float",
    str: "str",
    bool: "bool",
    type(None): "NoneType",
}

# Imports refused for student code: they reach the JS host (and so the network) from Python.
BLOCKED_MODULES = frozenset({"js", "pyodide", "pyodide_js", "_pyodide", "micropip", "pyodide_http"})

CO_OPTIMIZED = 0x01  # set on function code objects, not on module or class bodies
CO_VARARGS = 0x04
CO_VARKEYWORDS = 0x08
CO_GENERATOR = 0x20
CO_COROUTINE = 0x80
CO_ASYNC_GENERATOR = 0x200

# Code objects that run part of one statement (Phase 32): a line event inside them is the
# enclosing statement's line, so that statement's facts must not be attached to them.
EXPRESSION_SCOPES = frozenset({"<genexpr>", "<listcomp>", "<dictcomp>", "<setcomp>", "<lambda>"})
SRC_CAP = 80  # longest source text kept for an expression (longer ones keep no text)
EXPR_DEPTH = 6  # deeper sub-expressions are summarized as {"type": "other"}

# NumPy arrays (Phase 34): at most this many values are captured per array, flat, in C order; the
# rest are counted in `omitted`. Only these dtype kinds have primitive values (bool, signed and
# unsigned int, float, unicode str); arrays of any other dtype stay a summary.
NDARRAY_CAP = 200
NDARRAY_KINDS = frozenset("biufU")

# pandas (Phase 35): a DataFrame or Series is captured as its first TABLE_ROWS rows and first
# TABLE_COLS columns (the true shape is always recorded); each cell's text is capped at
# TABLE_REPR_CAP characters. A GroupBy records at most GROUPS_CAP groups, GROUP_ROWS rows of each.
TABLE_ROWS = 20
TABLE_COLS = 12
TABLE_REPR_CAP = 40
GROUPS_CAP = 20
GROUP_ROWS = 3
PANDAS_KINDS = {
    "DataFrame": "dataframe",
    "Series": "series",
    "DataFrameGroupBy": "groupby",
    "SeriesGroupBy": "groupby",
}

# matplotlib (Phase 36): figures are captured when `plt.show()` (or `fig.show()`) runs and when the
# program ends, at most FIGURES_CAP per run. Each is an SVG when that is under FIGURE_BYTES_CAP
# bytes, else a PNG at FIGURE_PNG_DPI (when that is under the cap too, and the canvas is at most
# FIGURE_MAX_PIXELS); anything larger is a "too large" note with no image.
FIGURES_CAP = 6
FIGURE_BYTES_CAP = 300 * 1024
FIGURE_PNG_DPI = 100
FIGURE_MAX_PIXELS = 3000 * 3000
# The Axes methods whose use names the chart type (the outermost call only: `hist` draws with `bar`).
CHART_CALLS = ("plot", "scatter", "bar", "barh", "hist", "pie", "boxplot")
# Text kept for a title, axis label or legend entry, and the most legend entries kept per axes.
FIGURE_TEXT_CAP = 80
LEGEND_CAP = 12

_BINOPS = {
    _ast.Add: "+",
    _ast.Sub: "-",
    _ast.Mult: "*",
    _ast.Div: "/",
    _ast.FloorDiv: "//",
    _ast.Mod: "%",
    _ast.Pow: "**",
    _ast.MatMult: "@",
    _ast.LShift: "<<",
    _ast.RShift: ">>",
    _ast.BitOr: "|",
    _ast.BitXor: "^",
    _ast.BitAnd: "&",
}
_CMPOPS = {
    _ast.Eq: "==",
    _ast.NotEq: "!=",
    _ast.Lt: "<",
    _ast.LtE: "<=",
    _ast.Gt: ">",
    _ast.GtE: ">=",
    _ast.Is: "is",
    _ast.IsNot: "is not",
    _ast.In: "in",
    _ast.NotIn: "not in",
}
_UNARYOPS = {_ast.Not: "not", _ast.USub: "-", _ast.UAdd: "+", _ast.Invert: "~"}
_DISPLAYS = {_ast.Tuple: "tuple", _ast.List: "list", _ast.Set: "set", _ast.Dict: "dict"}
_COMPREHENSIONS = {
    _ast.ListComp: "list",
    _ast.SetComp: "set",
    _ast.DictComp: "dict",
    _ast.GeneratorExp: "generator",
}
# Statement classes named as they are, with no further facts.
_PLAIN = {
    _ast.Pass: "Pass",
    _ast.Break: "Break",
    _ast.Continue: "Continue",
}


class _Statements:
    """What each source line's statement is, from Python's ``ast`` (Phase 32).

    The tree is indexed once by line; a line's facts are built the first time that line runs
    (``describe``), so a long program pays only for the lines it reaches. A line that starts two
    statements (``a = 1; b = 2``, ``if x: y = 1``) is ``Multiple``: nothing more is claimed about it.
    """

    def __init__(self, source):
        self.lines = source.splitlines()
        self.encoded = [ln.encode("utf-8") for ln in self.lines]
        self.nodes = {}  # line -> ast node, or None for a line that starts several statements
        self.elifs = set()  # id() of the If nodes that are written as `elif`
        try:
            tree = _ast.parse(source)
        except (SyntaxError, ValueError, RecursionError, MemoryError):
            return
        self._index(tree.body)

    # ── index ────────────────────────────────────────────────────────────────────────────────

    def _put(self, line, node):
        self.nodes[line] = None if line in self.nodes else node

    def _index(self, body):
        for node in body:
            self._put(node.lineno, node)
            if isinstance(node, _ast.If) and len(node.orelse) == 1:
                inner = node.orelse[0]
                if isinstance(inner, _ast.If) and self._text(inner.lineno).lstrip().startswith("elif"):
                    self.elifs.add(id(inner))
            for field in ("body", "orelse", "finalbody"):
                self._index(getattr(node, field, None) or [])
            for handler in getattr(node, "handlers", None) or []:
                self._put(handler.lineno, handler)
                self._index(handler.body)
            for case in getattr(node, "cases", None) or []:
                self._index(case.body)

    # ── text ─────────────────────────────────────────────────────────────────────────────────

    def _text(self, line):
        return self.lines[line - 1] if 1 <= line <= len(self.lines) else ""

    def _src(self, node):
        """The node's own source text, when it is on one line and short enough; else None."""
        line = getattr(node, "lineno", None)
        if line is None or getattr(node, "end_lineno", None) != line:
            return None
        if not 1 <= line <= len(self.encoded):
            return None
        try:
            text = self.encoded[line - 1][node.col_offset : node.end_col_offset].decode("utf-8")
        except (UnicodeDecodeError, TypeError):
            return None
        return text if 0 < len(text) <= SRC_CAP else None

    def _header(self, keyword, start, stop):
        """The line in [start, stop] whose text begins with ``keyword:`` (an else / finally header)."""
        for line in range(stop, start - 1, -1):
            text = self._text(line).lstrip()
            if text.startswith(keyword) and text[len(keyword) :].lstrip().startswith(":"):
                return line
        return None

    # ── facts ────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _block(body):
        return {"first": body[0].lineno, "last": body[-1].end_lineno}

    def _else(self, node):
        """The `else:` clause of an if / for / while / try, or None."""
        if not node.orelse:
            return None
        after = node.handlers[-1].end_lineno if getattr(node, "handlers", None) else node.body[-1].end_lineno
        line = self._header("else", after + 1, node.orelse[0].lineno)
        if line is None:
            return None
        return {"kind": "else", "line": line, **self._block(node.orelse)}

    def _expr(self, node, depth=0):
        if node is None:
            return None
        out = self._expr_kind(node, depth)
        # A name's text is its id, and a constant written as its repr needs no copy.
        src = None if isinstance(node, _ast.Name) else self._src(node)
        if src is not None and src == out.get("repr"):
            src = None
        if src is not None:
            out["src"] = src
        return out

    def _expr_kind(self, node, depth):
        if depth > EXPR_DEPTH:
            return {"type": "other"}
        d = depth + 1
        if isinstance(node, _ast.Name):
            return {"type": "name", "id": node.id}
        if isinstance(node, _ast.Constant):
            r = repr(node.value)
            return {"type": "const", "repr": r} if len(r) <= SRC_CAP else {"type": "other"}
        if isinstance(node, _ast.Subscript):
            # Phase 34: a slice (`a[1:4]`) or a tuple of indices (`m[0, 1]`, `m[:, 1]`) is kept too,
            # for NumPy indexing; it was `other` before.
            return {"type": "subscript", "value": self._expr(node.value, d), "index": self._expr(node.slice, d)}
        if isinstance(node, _ast.Slice):
            out = {"type": "slice"}
            for part in ("lower", "upper", "step"):
                sub = getattr(node, part)
                if sub is not None:
                    out[part] = self._expr(sub, d)
            return out
        if isinstance(node, _ast.Attribute):
            return {"type": "attribute", "value": self._expr(node.value, d), "attr": node.attr}
        if isinstance(node, _ast.BinOp) and type(node.op) in _BINOPS:
            return {
                "type": "binop",
                "op": _BINOPS[type(node.op)],
                "left": self._expr(node.left, d),
                "right": self._expr(node.right, d),
            }
        if isinstance(node, _ast.UnaryOp) and type(node.op) in _UNARYOPS:
            return {"type": "unary", "op": _UNARYOPS[type(node.op)], "operand": self._expr(node.operand, d)}
        if isinstance(node, _ast.Compare) and all(type(op) in _CMPOPS for op in node.ops):
            return {
                "type": "compare",
                "ops": [_CMPOPS[type(op)] for op in node.ops],
                "left": self._expr(node.left, d),
                "comparators": [self._expr(c, d) for c in node.comparators],
            }
        if isinstance(node, _ast.BoolOp):
            return {
                "type": "boolop",
                "op": "and" if isinstance(node.op, _ast.And) else "or",
                "values": [self._expr(v, d) for v in node.values],
            }
        if isinstance(node, _ast.Call):
            if any(isinstance(a, _ast.Starred) for a in node.args) or any(k.arg is None for k in node.keywords):
                return {"type": "other"}
            out = {"type": "call", "func": self._expr(node.func, d), "args": [self._expr(a, d) for a in node.args]}
            if node.keywords:
                out["keywords"] = [k.arg for k in node.keywords]
                # Phase 34: the keyword values too (`m.sum(axis=0)`).
                out["kwargs"] = [{"name": k.arg, "value": self._expr(k.value, d)} for k in node.keywords]
            return out
        if type(node) in _DISPLAYS:
            out = {"type": "display", "of": _DISPLAYS[type(node)]}
            elts = getattr(node, "elts", None) or []
            if isinstance(node, (_ast.Tuple, _ast.List)) and len(elts) <= 8 and not any(isinstance(x, _ast.Starred) for x in elts):
                out["items"] = [self._expr(e, d) for e in node.elts]
            return out
        if type(node) in _COMPREHENSIONS:
            return {"type": "comprehension", "of": _COMPREHENSIONS[type(node)]}
        if isinstance(node, _ast.JoinedStr):
            return {"type": "fstring"}
        if isinstance(node, (_ast.Yield, _ast.YieldFrom)):
            return {"type": "yield"}
        return {"type": "other"}

    def describe(self, line):
        """The facts about the statement starting on ``line``, or None if no statement starts there."""
        if line not in self.nodes:
            return None
        node = self.nodes[line]
        if node is None:
            return {"kind": "Multiple", "line": line}
        out = {"kind": None, "line": line, "end": getattr(node, "end_lineno", line) or line}
        e = self._expr
        if isinstance(node, _ast.Assign):
            out.update(kind="Assign", targets=[e(t) for t in node.targets], value=e(node.value))
        elif isinstance(node, _ast.AugAssign):
            out.update(kind="AugAssign", target=e(node.target), op=_BINOPS.get(type(node.op), "?"), value=e(node.value))
        elif isinstance(node, _ast.AnnAssign):
            out.update(kind="AnnAssign", target=e(node.target), annotation=self._src(node.annotation))
            if node.value is not None:
                out["value"] = e(node.value)
        elif isinstance(node, _ast.If):
            out.update(kind="Elif" if id(node) in self.elifs else "If", test=e(node.test), body=self._block(node.body))
            if len(node.orelse) == 1 and id(node.orelse[0]) in self.elifs:
                inner = node.orelse[0]
                out["orelse"] = {"kind": "elif", "line": inner.lineno, "first": inner.lineno, "last": inner.end_lineno}
            elif node.orelse:
                clause = self._else(node)
                if clause is not None:
                    out["orelse"] = clause
        elif isinstance(node, (_ast.For, _ast.AsyncFor)):
            out.update(kind="For", target=e(node.target), iter=e(node.iter), body=self._block(node.body))
        elif isinstance(node, _ast.While):
            out.update(kind="While", test=e(node.test), body=self._block(node.body))
        elif isinstance(node, _ast.Return):
            out.update(kind="Return")
            if node.value is not None:
                out["value"] = e(node.value)
        elif isinstance(node, _ast.Expr):
            out.update(kind="Expr", value=e(node.value))
        elif isinstance(node, (_ast.Import, _ast.ImportFrom)):
            out.update(kind="Import", names=[a.asname or a.name for a in node.names])
            if isinstance(node, _ast.ImportFrom) and node.module:
                out["module"] = node.module
        elif isinstance(node, (_ast.FunctionDef, _ast.AsyncFunctionDef)):
            a = node.args
            params = [p.arg for p in a.posonlyargs + a.args]
            if a.vararg is not None:
                params.append("*" + a.vararg.arg)
            params += [p.arg for p in a.kwonlyargs]
            if a.kwarg is not None:
                params.append("**" + a.kwarg.arg)
            out.update(kind="FunctionDef", name=node.name, params=params)
        elif isinstance(node, _ast.ClassDef):
            out.update(kind="ClassDef", name=node.name)
        elif isinstance(node, (_ast.Try, getattr(_ast, "TryStar", _ast.Try))):
            out.update(kind="Try", body=self._block(node.body))
            out["handlers"] = [
                {
                    "line": h.lineno,
                    "type": self._src(h.type) if h.type is not None else None,
                    **self._block(h.body),
                }
                for h in node.handlers
            ]
            if node.orelse:
                clause = self._else(node)
                if clause is not None:
                    out["orelse"] = clause
            if node.finalbody:
                fin = self._header("finally", node.body[-1].end_lineno + 1, node.finalbody[0].lineno)
                if fin is not None:
                    out["finalbody"] = {"line": fin, **self._block(node.finalbody)}
        elif isinstance(node, _ast.ExceptHandler):
            out.update(kind="Except", type=self._src(node.type) if node.type is not None else None, body=self._block(node.body))
            if node.name:
                out["name"] = node.name
        elif isinstance(node, _ast.Raise):
            out.update(kind="Raise")
            if node.exc is not None:
                out["value"] = e(node.exc)
        elif type(node) in _PLAIN:
            out.update(kind=_PLAIN[type(node)])
        elif isinstance(node, (_ast.With, _ast.AsyncWith)):
            out.update(kind="With", body=self._block(node.body))
        elif isinstance(node, _ast.Delete):
            out.update(kind="Delete", targets=[e(t) for t in node.targets])
        elif isinstance(node, (_ast.Global, _ast.Nonlocal)):
            out.update(kind="Global" if isinstance(node, _ast.Global) else "Nonlocal", names=list(node.names))
        elif isinstance(node, _ast.Assert):
            out.update(kind="Assert", test=e(node.test))
        else:
            out.update(kind="Other", name=type(node).__name__)
        # Loops (for / while) and try statements can have an `else:` clause too.
        if out["kind"] in ("For", "While") and node.orelse:
            clause = self._else(node)
            if clause is not None:
                out["orelse"] = clause
        return out


class _Abort(BaseException):
    """Stops the student program. A BaseException so ``except Exception`` cannot swallow it."""

    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


class _Capture:
    """``sys.stdout`` / ``sys.stderr`` replacement: cumulative text, capped at ``max_lines`` lines."""

    encoding = "utf-8"
    errors = "strict"

    def __init__(self, max_lines):
        self.text = ""
        self.newlines = 0
        self.max_lines = max_lines
        self.full = False

    def write(self, s):
        if not isinstance(s, str):
            raise TypeError("write() argument must be str, not " + type(s).__name__)
        if self.full or (s and self.newlines >= self.max_lines):
            self.full = True
            raise _Abort("stdout")
        room = self.max_lines - self.newlines
        n = s.count("\n")
        if n > room:
            # Keep exactly max_lines complete lines, then stop the program.
            cut = -1
            for _ in range(room):
                cut = s.index("\n", cut + 1)
            self.text += s[: cut + 1]
            self.newlines = self.max_lines
            self.full = True
            raise _Abort("stdout")
        if len(self.text) + len(s) > STDOUT_MAX_CHARS:
            self.text += s[: max(0, STDOUT_MAX_CHARS - len(self.text))]
            self.full = True
            raise _Abort("stdout")
        self.text += s
        self.newlines += n
        return len(s)

    def flush(self):
        pass

    def isatty(self):
        return False

    def writable(self):
        return True


_MISSING = object()


class _Figures:
    """matplotlib figures as step output (Phase 36).

    Active only when matplotlib is already imported (the worker imports it, untraced, for a program
    that uses it); otherwise every method is a no-op and nothing third-party is touched. During a
    run, ``pyplot.show`` and ``Figure.show`` are replaced by functions that capture the open
    figures (then close them), and the chart methods of ``Axes`` (:data:`CHART_CALLS`) by thin
    wrappers that remember which were called on each axes. Everything is restored when the run ends.

    A captured figure waits in ``pending`` until the recorder's next snapshot, which carries it: the
    state after the line that showed it. Figures still open when the program ends are captured just
    before the module's last snapshot (its ``return`` event).
    """

    def __init__(self, rec):
        self.rec = rec
        self.mpl = None
        self.plt = None
        self.count = 0
        self.pending = []
        self.kinds = {}  # id(axes) -> chart calls made on it, in first-call order
        self.depth = 0  # > 0 while inside a chart call (its inner calls are not counted)
        self.saved = []  # (owner, attribute, original) to restore

    # ── setup ────────────────────────────────────────────────────────────────────────────────

    def setup(self):
        if "matplotlib" not in _sys.modules:
            return
        try:
            import importlib

            mpl = importlib.import_module("matplotlib")
            plt = importlib.import_module("matplotlib.pyplot")
            axes_mod = importlib.import_module("matplotlib.axes")
            figure_mod = importlib.import_module("matplotlib.figure")
            # Non-interactive (a worker has no display), and resolved now rather than lazily at the
            # program's first figure, which would also re-annotate the patched `show` below.
            plt.switch_backend("Agg")
            # Each run starts from matplotlib's defaults with no figure open, whatever an earlier run
            # in this worker did (the backend is not reset by rcdefaults).
            mpl.rcdefaults()
            plt.close("all")
        except Exception:  # noqa: BLE001 - a broken matplotlib must not stop the program
            return
        self.mpl, self.plt = mpl, plt
        self._patch(plt, "show", self._show())
        self._patch(figure_mod.Figure, "show", self._figure_show())
        for name in CHART_CALLS:
            original = axes_mod.Axes.__dict__.get(name)
            if original is not None:
                self._patch(axes_mod.Axes, name, self._chart(name, original))

    def _patch(self, owner, name, value):
        # An inherited attribute (not in the owner's own __dict__) is deleted again on teardown.
        self.saved.append((owner, name, owner.__dict__.get(name, _MISSING)))
        setattr(owner, name, value)

    def teardown(self):
        for owner, name, original in reversed(self.saved):
            try:
                if original is _MISSING:
                    delattr(owner, name)
                else:
                    setattr(owner, name, original)
            except Exception:  # noqa: BLE001
                pass
        self.saved = []
        if self.plt is not None:
            try:
                self.plt.close("all")
            except Exception:  # noqa: BLE001
                pass

    # ── what the student calls ───────────────────────────────────────────────────────────────

    def _show(self):
        figs = self

        # A plain function, not a bound method: pyplot sets attributes on its `show`.
        def show(*args, **kwargs):
            """``plt.show()``: capture every open figure, then close them all."""
            figs.capture("show")

        return show

    def _figure_show(self):
        figs = self

        def show(fig, *args, **kwargs):
            """``fig.show()``: capture that figure, then close it."""
            figs._take(fig, getattr(fig, "number", None), "show")
            try:
                figs.plt.close(fig)
            except Exception:  # noqa: BLE001
                pass

        return show

    def _chart(self, name, original):
        figs = self

        def chart(ax, *args, **kwargs):
            if figs.depth == 0:
                kinds = figs.kinds.get(id(ax))
                if kinds is None:
                    kinds = figs.kinds[id(ax)] = []
                    figs.rec.keep.append(ax)  # its id() must not be reused while it is a key
                if name not in kinds:
                    kinds.append(name)
            figs.depth += 1
            try:
                return original(ax, *args, **kwargs)
            finally:
                figs.depth -= 1

        for attr in ("__name__", "__qualname__", "__doc__", "__module__"):
            try:
                setattr(chart, attr, getattr(original, attr))
            except (AttributeError, TypeError):
                pass
        chart.__wrapped__ = original
        return chart

    # ── capture ──────────────────────────────────────────────────────────────────────────────

    def capture(self, trigger):
        """Capture every open figure (``trigger``: ``show`` or ``end``), then close them all."""
        plt = self.plt
        if plt is None:
            return
        try:
            numbers = list(plt.get_fignums())
        except Exception:  # noqa: BLE001
            return
        for num in numbers:
            try:
                fig = plt.figure(num)
            except Exception:  # noqa: BLE001
                continue
            self._take(fig, num, trigger)
        try:
            plt.close("all")
        except Exception:  # noqa: BLE001
            pass

    def _take(self, fig, num, trigger):
        self.count += 1
        entry = {"id": "fig" + str(self.count), "number": int(num) if isinstance(num, int) else self.count, "trigger": trigger}
        width = height = 0.0
        try:
            entry.update(self._facts(fig))
            width, height = entry["width"], entry["height"]
        except Exception:  # noqa: BLE001 - a figure the recorder can't read keeps the basics
            entry.setdefault("axes", [])
        if self.count > FIGURES_CAP:
            entry.update(format="none", reason="cap")
        else:
            entry.update(self._render(fig, width, height))
        self.pending.append(entry)

    @staticmethod
    def _text(s):
        s = str(s)
        return s if len(s) <= FIGURE_TEXT_CAP else s[: FIGURE_TEXT_CAP - 1] + "…"

    def _facts(self, fig):
        """The figure's size (inches), title, and per axes: chart calls, title, labels, legend."""
        w, h = fig.get_size_inches()
        out = {"width": round(float(w), 3), "height": round(float(h), 3)}
        axes = []
        for ax in fig.get_axes():
            a = {"kinds": list(self.kinds.get(id(ax), []))}
            for key, getter in (("title", ax.get_title), ("xlabel", ax.get_xlabel), ("ylabel", ax.get_ylabel)):
                text = getter()
                if text:
                    a[key] = self._text(text)
            legend = ax.get_legend()
            if legend is not None:
                a["legend"] = [self._text(t.get_text()) for t in legend.get_texts()[:LEGEND_CAP]]
            axes.append(a)
        out["axes"] = axes
        sup = fig.get_suptitle() if hasattr(fig, "get_suptitle") else ""
        titled = [a["title"] for a in axes if "title" in a]
        if sup:
            out["title"] = self._text(sup)
        elif len(axes) == 1 and titled:
            out["title"] = titled[0]
        return out

    def _render(self, fig, width, height):
        """SVG under the cap, else a PNG at 100 dpi under the cap, else a "too large" note."""
        import base64
        import io
        import warnings

        try:
            with warnings.catch_warnings():
                # Rendering warnings are matplotlib's, not the program's output.
                warnings.simplefilter("ignore")
                # Text as <text> (not glyph paths): about 40% smaller. Fixed ids: stable recordings.
                with self.mpl.rc_context({"svg.fonttype": "none", "svg.hashsalt": "se-viz"}):
                    buf = io.BytesIO()
                    fig.savefig(buf, format="svg", metadata={"Creator": None, "Date": None, "Format": None, "Type": None})
                svg = buf.getvalue()
                if len(svg) < FIGURE_BYTES_CAP:
                    return {"format": "svg", "bytes": len(svg), "data": svg.decode("utf-8")}
                if width * FIGURE_PNG_DPI * height * FIGURE_PNG_DPI > FIGURE_MAX_PIXELS:
                    return {"format": "none", "reason": "too-large", "bytes": len(svg)}
                buf = io.BytesIO()
                fig.savefig(buf, format="png", dpi=FIGURE_PNG_DPI)
                png = buf.getvalue()
            if len(png) < FIGURE_BYTES_CAP:
                return {
                    "format": "png",
                    "bytes": len(png),
                    "data": "data:image/png;base64," + base64.b64encode(png).decode("ascii"),
                }
            return {"format": "none", "reason": "too-large", "bytes": len(png)}
        except _Abort:
            raise
        except Exception as e:  # noqa: BLE001 - a figure that fails to render is a note, not a crash
            return {"format": "none", "reason": "error", "error": type(e).__name__}

    def take_pending(self):
        out, self.pending = self.pending, []
        return out


class _Recorder:
    def __init__(self, stdin_lines, limits, on_chunk=None):
        self.max_steps = int(limits["maxSteps"])
        self.max_depth = int(limits["maxDepth"])
        self.max_items = int(limits["maxContainerItems"])
        self.max_objects = int(limits["maxObjects"])
        self.timeout_s = float(limits["timeoutMs"]) / 1000.0
        # Total JSON characters of all snapshots (Phase 31); older callers may omit it.
        self.max_chars = int(limits.get("maxTraceChars", 8_000_000))
        self.stdin = list(stdin_lines)
        self.stdin_pos = 0
        self.out = _Capture(int(limits["maxStdoutLines"]))
        # Each snapshot is serialized as it is taken: that is what the size budget measures, what is
        # streamed, and what the final result is joined from (so nothing is serialized twice).
        self.snaps = []
        self.chars = 0
        self.on_chunk = on_chunk
        self.flushed = 0
        self.keep = []  # strong refs to every object and frame seen: id() is never reused
        self.obj_ids = {}  # id(obj) -> "oN"
        self.frame_ids = {}  # id(frame) -> "fN"
        self.frame_names = {}  # "fN" -> local names in first-seen (definition) order
        self.unwinding = set()  # frame ids propagating an exception since their last line event
        self.truncated = None
        self.error = None
        self.deadline = 0.0
        self.statements = None  # _Statements for the program, built once it compiles (Phase 32)
        self.described = set()  # lines whose statement facts were already sent
        self.figs = _Figures(self)  # matplotlib figures (Phase 36)

    # ── ids ──────────────────────────────────────────────────────────────────────────────────

    def _obj_id(self, v):
        key = id(v)
        oid = self.obj_ids.get(key)
        if oid is None:
            oid = "o" + str(len(self.obj_ids) + 1)
            self.obj_ids[key] = oid
            self.keep.append(v)
        return oid

    def _frame_id(self, frame):
        key = id(frame)
        fid = self.frame_ids.get(key)
        if fid is None:
            fid = "f" + str(len(self.frame_ids) + 1)
            self.frame_ids[key] = fid
            self.frame_names[fid] = []
            self.keep.append(frame)
        return fid

    # ── values ───────────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _cap(r, longer=False):
        if longer or len(r) > REPR_CAP:
            return r[: REPR_CAP - 1] + "…", True
        return r, False

    def _prim(self, v, t):
        if t is str:
            r, cut = self._cap(repr(v[:REPR_CAP]), len(v) > REPR_CAP)
        elif t is int:
            try:
                r, cut = self._cap(repr(v))
            except ValueError:  # more digits than sys.get_int_max_str_digits()
                r, cut = "<int with " + str(v.bit_length()) + " bits>", True
        else:
            r, cut = self._cap(repr(v))
        out = {"kind": "prim", "type": PRIMITIVES[t], "repr": r}
        if cut:
            out["truncated"] = True
        return out

    def _value(self, v, walk):
        t = type(v)
        if t in PRIMITIVES:
            return self._prim(v, t)
        scalar = self._numpy_scalar(v, t)
        if scalar is not None:
            return scalar
        oid = self._obj_id(v)
        walk.visit(oid, v)
        return {"kind": "ref", "id": oid}

    def _safe_repr(self, v):
        try:
            r = repr(v)
        except BaseException as e:  # noqa: BLE001 - a broken __repr__ must not stop the trace
            r = "<" + type(v).__name__ + " (repr failed: " + type(e).__name__ + ")>"
        return self._cap(r)[0]

    def _numpy_scalar(self, v, t):
        """A NumPy scalar (``np.int64(3)``, ``np.float64(2.5)``) as a primitive with its dtype (Phase 34).

        Detected by the type's module root, without importing NumPy. Scalars whose value is not a
        primitive (complex, datetime, bytes, ...) return None and stay summaries.
        """
        if (getattr(t, "__module__", "") or "").split(".")[0] != "numpy" or _is_ndarray(v):
            return None
        try:
            if getattr(v, "ndim", None) != 0 or not hasattr(v, "dtype"):
                return None
            item = v.item()
        except BaseException:  # noqa: BLE001 - an odd object is simply not a scalar
            return None
        it = type(item)
        if it not in PRIMITIVES or it is type(None):
            return None
        out = self._prim(item, it)
        out["dtype"] = str(v.dtype)
        return out

    def _ndarray(self, v, walk):
        """A NumPy ndarray (Phase 34): shape, dtype, capped flat values in C order, and its memory.

        Returns None for a dtype whose values aren't primitives (the array stays a summary).
        ``layout`` places the array's elements in the memory of the array that owns them (its
        ``base`` chain's end), so two views of the same data can be matched element by element:
        ``offset`` is bytes from the owner's first byte, ``strides`` and ``itemsize`` are NumPy's.
        """
        dtype = v.dtype
        # Subclasses (masked arrays, matrices) keep the summary: their values mean something else.
        if type(v).__name__ != "ndarray" or getattr(dtype, "kind", None) not in NDARRAY_KINDS:
            return None
        shape = [int(n) for n in v.shape]
        size = int(v.size)
        n = min(size, NDARRAY_CAP)
        values = [self._value(x, walk) for x in v.flat[:n].tolist()] if n else []
        out = {
            "kind": "ndarray",
            "library": "numpy",
            "type": type(v).__name__,
            "shape": shape,
            "dtype": str(dtype),
            "ndim": int(v.ndim),
            "values": values,
        }
        if size > n:
            out["omitted"] = size - n
        out["owndata"] = bool(v.flags.owndata)
        base = v.base
        if base is not None:
            out["base"] = self._value(base, walk)
        layout = {"offset": 0, "strides": [int(s) for s in v.strides], "itemsize": int(dtype.itemsize)}
        if base is not None:
            # Bytes from the owner's data: follow the base chain (NumPy usually collapses it to the
            # owner already), stopping at anything that isn't an ndarray.
            try:
                here = v.__array_interface__["data"][0]
                owner = base
                while _is_ndarray(owner) and owner.base is not None and _is_ndarray(owner.base):
                    owner = owner.base
                layout["offset"] = int(here - owner.__array_interface__["data"][0]) if _is_ndarray(owner) else None
            except BaseException:  # noqa: BLE001 - no layout is better than a wrong one
                layout["offset"] = None
        if layout["offset"] is not None:
            out["layout"] = layout
        return out

    # ── pandas (Phase 35) ────────────────────────────────────────────────────────────────────

    def _cell(self, x):
        """One table value as text: ``{"repr", "type"}`` (``truncated`` when cut to 40 characters).

        A primitive (and a NumPy scalar, through ``.item()``) is its ``repr``; anything else
        (``Timestamp``, ``NA``, a list in an object column) is its ``str``, as pandas prints it.
        Cells are text only: an object inside a table is never followed as a reference.
        """
        t = type(x)
        if t not in PRIMITIVES and (getattr(t, "__module__", "") or "").split(".")[0] == "numpy":
            try:
                if getattr(x, "ndim", None) == 0:
                    x = x.item()
                    t = type(x)
            except BaseException:  # noqa: BLE001 - keep the NumPy value
                pass
        if isinstance(x, tuple):  # a MultiIndex label or a multi-key group: its parts' reprs
            r = "(" + ", ".join(self._cell(p)["repr"] for p in x) + ("," if len(x) == 1 else "") + ")"
            tname = "tuple"
        elif t in PRIMITIVES:
            tname = PRIMITIVES[t]
            try:
                r = repr(x[: TABLE_REPR_CAP + 1]) if t is str else repr(x)
            except ValueError:  # an int too long for repr
                r = "<int with " + str(x.bit_length()) + " bits>"
        else:
            tname = t.__name__
            try:
                r = str(x)
            except BaseException as e:  # noqa: BLE001 - a broken __str__ must not stop the trace
                r = "<" + tname + " (str failed: " + type(e).__name__ + ")>"
        out = {"repr": r, "type": tname}
        if len(r) > TABLE_REPR_CAP:
            out["repr"] = r[: TABLE_REPR_CAP - 1] + "…"
            out["truncated"] = True
        return out

    def _columns(self, frame):
        """The first TABLE_COLS columns of a DataFrame: label, dtype and missing count (whole column)."""
        part = frame.iloc[:, :TABLE_COLS]
        missing = [int(n) for n in part.isna().sum().tolist()]
        return [
            {"label": self._cell(label), "dtype": str(dtype), "missing": missing[j]}
            for j, (label, dtype) in enumerate(zip(part.columns.tolist(), part.dtypes.tolist()))
        ]

    def _rows(self, frame):
        """Rows of a (small) DataFrame as lists of cells, columns capped at TABLE_COLS."""
        part = frame.iloc[:, :TABLE_COLS]
        return [[self._cell(x) for x in row] for row in part.itertuples(index=False, name=None)]

    def _pandas(self, kind, v, walk):
        """A DataFrame, Series or GroupBy (Phase 35); the shape is in PYTHON_TRACE_FORMAT.md."""
        out = {"kind": kind, "library": "pandas", "type": type(v).__name__}
        if kind == "dataframe":
            nrows, ncols = (int(n) for n in v.shape)
            head = v.iloc[:TABLE_ROWS]
            out["shape"] = [nrows, ncols]
            out["columns"] = self._columns(v)
            if ncols > TABLE_COLS:
                out["columnsOmitted"] = ncols - TABLE_COLS
            out["index"] = [self._cell(x) for x in head.index.tolist()]
            if v.index.name is not None:
                out["indexName"] = self._cell(v.index.name)["repr"]
            out["rows"] = self._rows(head)
            if nrows > TABLE_ROWS:
                out["rowsOmitted"] = nrows - TABLE_ROWS
            return out
        if kind == "series":
            n = int(len(v))
            head = v.iloc[:TABLE_ROWS]
            out["length"] = n
            out["dtype"] = str(v.dtype)
            out["name"] = None if v.name is None else self._cell(v.name)
            out["missing"] = int(v.isna().sum())
            out["index"] = [self._cell(x) for x in head.index.tolist()]
            if v.index.name is not None:
                out["indexName"] = self._cell(v.index.name)["repr"]
            out["values"] = [self._cell(x) for x in head.tolist()]
            if n > TABLE_ROWS:
                out["omitted"] = n - TABLE_ROWS
            return out
        # A GroupBy: the keys, each group's label and size, and its first rows (of the grouped
        # object, `gb.obj`, which is recorded as a reference: the frame the groups come from).
        obj = v.obj
        keys = v.keys
        keys = list(keys) if isinstance(keys, list) else [keys]

        def key_text(k):
            if isinstance(k, str):
                return k
            name = getattr(k, "name", None)  # grouped by a Series (or a Grouper): its name
            if isinstance(name, str) and not isinstance(k, type):
                return name
            return self._cell(k)["repr"]

        out["keys"] = [key_text(k) for k in keys]
        out["ngroups"] = int(v.ngroups)
        out["rowsTotal"] = int(len(obj))
        out["source"] = self._value(obj, walk)
        is_frame = _pandas_kind(obj) == "dataframe"
        if is_frame:
            out["columns"] = self._columns(obj)
            if obj.shape[1] > TABLE_COLS:
                out["columnsOmitted"] = int(obj.shape[1]) - TABLE_COLS
        else:
            name = obj.name
            out["columns"] = [
                {
                    "label": self._cell(name) if name is not None else {"repr": "None", "type": "NoneType"},
                    "dtype": str(obj.dtype),
                    "missing": int(obj.isna().sum()),
                }
            ]
        groups = []
        for i, (label, positions) in enumerate(v.indices.items()):
            if i >= GROUPS_CAP:
                break
            first = [int(p) for p in positions[:GROUP_ROWS]]
            part = obj.iloc[first]
            rows = self._rows(part) if is_frame else [[self._cell(x)] for x in part.tolist()]
            groups.append(
                {
                    "label": self._cell(label),
                    "size": int(len(positions)),
                    "index": [self._cell(x) for x in part.index.tolist()],
                    "rows": rows,
                }
            )
        out["groups"] = groups
        if out["ngroups"] > len(groups):
            out["groupsOmitted"] = out["ngroups"] - len(groups)
        return out

    def _describe(self, v, walk):
        t = type(v)
        tname = t.__name__
        root = (getattr(t, "__module__", "") or "").split(".")[0]
        if root == "numpy" and _is_ndarray(v):
            try:
                arr = self._ndarray(v, walk)
            except Exception:  # noqa: BLE001 - an array-like the recorder can't read stays a summary
                arr = None
            if arr is not None:
                return arr
        if root == "numpy" and hasattr(v, "shape") and hasattr(v, "dtype"):
            return {
                "kind": "summary",
                "library": "numpy",
                "type": tname,
                "shape": [int(n) for n in v.shape],
                "dtype": str(v.dtype),
            }
        if root == "pandas":
            kind = _pandas_kind(v)
            if kind is not None:
                try:
                    table = self._pandas(kind, v, walk)
                except Exception:  # noqa: BLE001 - a frame the recorder can't read stays a summary
                    table = None
                if table is not None:
                    return table
        if root == "pandas" and hasattr(v, "shape"):
            if hasattr(v, "dtypes") and not hasattr(v, "dtype"):  # DataFrame: one dtype per column
                seen = []
                for d in v.dtypes:
                    if str(d) not in seen:
                        seen.append(str(d))
                dtype = ", ".join(seen)
            else:
                dtype = str(getattr(v, "dtype", ""))
            return {
                "kind": "summary",
                "library": "pandas",
                "type": tname,
                "shape": [int(n) for n in v.shape],
                "dtype": dtype,
            }
        if root == "matplotlib":
            # Phase 36: a Figure, Axes, Line2D ... is one opaque object. Its __dict__ is matplotlib's
            # internals (hundreds of objects), not the program's data.
            return {"kind": "other", "type": tname, "repr": _mpl_repr(self._safe_repr(v), tname)}
        if isinstance(v, dict):
            entries = []
            for i, (k, val) in enumerate(v.items()):
                if i >= self.max_items:
                    break
                entries.append({"key": self._value(k, walk), "value": self._value(val, walk)})
            out = {"kind": "dict", "type": tname, "entries": entries}
            if len(v) > len(entries):
                out["omitted"] = len(v) - len(entries)
            return out
        if isinstance(v, (list, tuple)):
            kind = "list" if isinstance(v, list) else "tuple"
            items = [self._value(x, walk) for x in v[: self.max_items]]
            out = {"kind": kind, "type": tname, "items": items}
            if len(v) > len(items):
                out["omitted"] = len(v) - len(items)
            return out
        if isinstance(v, (set, frozenset)):
            kind = "set" if isinstance(v, set) else "frozenset"
            members = list(v)
            # Set iteration order depends on hashes (randomized for str): sort for a stable display.
            try:
                members.sort()
            except TypeError:  # mixed types: group by type name, then by repr
                try:
                    members.sort(key=lambda x: (type(x).__name__, repr(x)))
                except BaseException:  # noqa: BLE001 - keep iteration order
                    pass
            items = [self._value(x, walk) for x in members[: self.max_items]]
            out = {"kind": kind, "type": tname, "items": items}
            if len(v) > len(items):
                out["omitted"] = len(v) - len(items)
            return out
        if isinstance(v, (_types.FunctionType, _types.MethodType)):
            fn = v.__func__ if isinstance(v, _types.MethodType) else v
            code = fn.__code__
            n = code.co_argcount + code.co_kwonlyargcount
            params = list(code.co_varnames[:n])
            if code.co_flags & CO_VARARGS:
                params.insert(code.co_argcount, "*" + code.co_varnames[n])
                n += 1
            if code.co_flags & CO_VARKEYWORDS:
                params.append("**" + code.co_varnames[n])
            if isinstance(v, _types.MethodType):
                params = params[1:]
            return {"kind": "function", "type": tname, "name": fn.__qualname__, "params": params}
        if isinstance(v, type):
            return {"kind": "class", "type": "type", "name": v.__qualname__}
        attrs = getattr(v, "__dict__", None)
        if isinstance(attrs, dict) and not isinstance(v, _types.ModuleType):
            fields = []
            for i, (name, val) in enumerate(attrs.items()):
                if i >= self.max_items:
                    break
                if _is_dunder(name):
                    continue
                fields.append({"name": name, "value": self._value(val, walk)})
            return {"kind": "instance", "type": tname, "attrs": fields}
        return {"kind": "other", "type": tname, "repr": self._safe_repr(v)}

    # ── snapshots ────────────────────────────────────────────────────────────────────────────

    def _stop(self, reason):
        """Stop the program: remember why, hand over every snapshot taken so far, and raise."""
        self.truncated = reason
        self._flush(True)
        raise _Abort(reason)

    def _flush(self, final=False):
        """Hand the not-yet-streamed snapshots to the host (``on_chunk``), if there is one."""
        if self.on_chunk is None or self.flushed == len(self.snaps):
            if final and self.on_chunk is not None and self.truncated is not None:
                self._send("[]", self.truncated)
            return
        chunk = "[" + ", ".join(self.snaps[self.flushed :]) + "]"
        self.flushed = len(self.snaps)
        self._send(chunk, self.truncated if final else None)

    def _send(self, chunk, reason):
        try:
            self.on_chunk(chunk, len(self.snaps), reason)
        except Exception:  # noqa: BLE001 - a broken host callback must not break the run
            self.on_chunk = None

    def _snapshot(self, frame, event, arg):
        if len(self.snaps) >= self.max_steps:
            self._stop("steps")
        if _time.monotonic() > self.deadline:
            self._stop("time")
        # A generator's frame is called again each time it resumes (Phase 32).
        resumed = event == "call" and id(frame) in self.frame_ids

        chain = []
        f = frame
        while f is not None:
            if f.f_code.co_filename == FILENAME:
                chain.append(f)
            f = f.f_back
        chain.reverse()  # bottom-first: <module> is frames[0]

        walk = _Walk(self)
        frames = []
        for fr in chain:
            fid = self._frame_id(fr)
            names = self.frame_names[fid]
            local = fr.f_locals
            if fr.f_code.co_name == "<module>" and local is not fr.f_globals:
                # Phase 32 fix: while a comprehension inlined at module level runs (Python 3.12+),
                # `f_locals` holds only the comprehension's own names; the globals are still there.
                local = {**fr.f_globals, **local}
            for name in local:
                if name not in names:
                    names.append(name)
            variables = []
            for name in names:
                if name not in local or _is_dunder(name) or name.startswith("."):
                    continue
                v = local[name]
                if isinstance(v, _types.ModuleType):
                    continue
                variables.append({"name": name, "value": self._value(v, walk)})
            frames.append(
                {
                    "id": fid,
                    "name": fr.f_code.co_name,
                    "line": fr.f_lineno or fr.f_code.co_firstlineno,
                    "vars": variables,
                }
            )

        snap = {
            "event": event,
            "line": frame.f_lineno or frame.f_code.co_firstlineno,
            "frames": frames,
        }
        fid = self.frame_ids[id(frame)]
        code = frame.f_code
        if event == "line":
            # Phase 32: the statement on this line, sent with the first line event that runs it (in
            # a frame of its own scope: a generator expression's line is its enclosing statement's).
            line = snap["line"]
            if line not in self.described and code.co_name not in EXPRESSION_SCOPES:
                self.described.add(line)
                info = self.statements.describe(line) if self.statements is not None else None
                if info is not None:
                    snap["stmt"] = info
        elif event == "call":
            snap["call"] = self._call_info(frame, fid, walk, resumed)
        if event == "return":
            snap["function"] = _qualname(code)
            if code.co_flags & (CO_GENERATOR | CO_ASYNC_GENERATOR) and _yielding(frame):
                snap["yielded"] = True  # suspended at a `yield`, not finished (Phase 32)
            if fid in self.unwinding:
                snap["unwinding"] = True
            elif code.co_flags & CO_OPTIMIZED:  # functions only; module/class bodies return None
                snap["returnValue"] = self._value(arg, walk)
        elif event == "exception":
            exc_type, exc, _tb = arg
            snap["exception"] = {"type": exc_type.__name__, "message": str(exc)}
        snap["objects"] = walk.drain()
        if walk.omitted:
            snap["objectsOmitted"] = walk.omitted
        snap["stdout"] = self.out.text
        if self.figs.pending:
            # Phase 36: figures captured since the last snapshot belong to this one (the state after
            # the line that showed them).
            snap["figures"] = self.figs.take_pending()
        text = _json.dumps(snap, ensure_ascii=False)
        if self.chars + len(text) > self.max_chars:
            self._stop("size")
        self.chars += len(text) + 2  # ", " between snapshots
        self.snaps.append(text)
        # Streamed at once (Phase 31): a program that then hangs where the tracer can't see it
        # (a loop inside a C function) and gets killed still has every step up to here. Measured:
        # about 5% slower than no streaming at 5000 snapshots.
        self._flush()

    def _call_info(self, frame, fid, walk, resumed):
        """Who was called, and with what (Phase 32): the parameters bound at the call, in order."""
        code = frame.f_code
        n = code.co_argcount + code.co_kwonlyargcount
        names = list(code.co_varnames[:n])
        if code.co_flags & CO_VARARGS:
            names.insert(code.co_argcount, code.co_varnames[n])
            n += 1
        if code.co_flags & CO_VARKEYWORDS:
            names.append(code.co_varnames[n])
        local = frame.f_locals
        # The hidden `.0` iterator a generator expression gets is skipped, as frame names skip it.
        args = [
            {"name": name, "value": self._value(local[name], walk)}
            for name in names
            if name in local and not name.startswith(".") and not _is_dunder(name)
        ]
        if code.co_name in EXPRESSION_SCOPES:
            scope = "lambda" if code.co_name == "<lambda>" else "comprehension"
        elif code.co_flags & (CO_GENERATOR | CO_ASYNC_GENERATOR):
            scope = "generator"
        elif code.co_flags & CO_COROUTINE:
            scope = "coroutine"
        elif not code.co_flags & CO_OPTIMIZED:
            scope = "class"  # a class body (the module body has no call event)
        else:
            scope = "function"
        out = {"function": _qualname(code), "args": args, "scope": scope}
        if resumed:
            out["resumed"] = True
        return out

    def _global(self, frame, event, arg):
        if self.truncated is not None or frame.f_code.co_filename != FILENAME:
            return None
        depth = 0
        f = frame
        while f is not None:
            if f.f_code.co_filename == FILENAME:
                depth += 1
            f = f.f_back
        if depth > self.max_depth:
            self.error = {
                "type": "RecursionError",
                "message": "maximum recursion depth exceeded (limit: "
                + str(self.max_depth)
                + " frames)",
                "line": frame.f_back.f_lineno if frame.f_back is not None else frame.f_lineno,
            }
            self._stop("depth")
        if frame.f_code.co_name != "<module>":
            self._snapshot(frame, "call", arg)
        return self._local

    def _local(self, frame, event, arg):
        if self.truncated is not None:
            return None
        if event == "line":
            self.unwinding.discard(self.frame_ids.get(id(frame)))
            self._snapshot(frame, "line", arg)
        elif event == "return":
            if frame.f_code.co_name == "<module>" and not _has_user_caller(frame):
                # Phase 36: figures still open when the program ends are its output too.
                self.figs.capture("end")
            self._snapshot(frame, "return", arg)
            self.unwinding.discard(self.frame_ids.get(id(frame)))
        elif event == "exception":
            if isinstance(arg[1], _Abort):  # e.g. the stdout cap, raised inside print()
                if self.truncated is None:
                    self.truncated = arg[1].reason
                    self._flush(True)
                return None
            self._frame_id(frame)
            self.unwinding.add(self.frame_ids[id(frame)])
            self._snapshot(frame, "exception", arg)
        return self._local

    # ── student builtins ─────────────────────────────────────────────────────────────────────

    def _input(self, prompt=""):
        self.out.write(str(prompt))
        if self.stdin_pos >= len(self.stdin):
            raise EOFError("EOF when reading a line")
        line = str(self.stdin[self.stdin_pos])
        self.stdin_pos += 1
        self.out.write(line + "\n")  # echo, as a terminal shows what was typed
        return line

    def _builtins(self):
        b = dict(vars(_builtins))
        real_import = _builtins.__import__

        def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
            if level == 0 and name.split(".")[0] in BLOCKED_MODULES:
                raise ImportError("module '" + name + "' is not available in SE-Viz")
            return real_import(name, globals, locals, fromlist, level)

        b["__import__"] = guarded_import
        b["input"] = self._input
        return b

    # ── run ──────────────────────────────────────────────────────────────────────────────────

    def run(self, source):
        """Run ``source`` and return the result as JSON text (the shape in PYTHON_TRACE_FORMAT.md)."""
        try:
            code = compile(source, FILENAME, "exec", dont_inherit=True)
        except (SyntaxError, ValueError) as e:
            return _json.dumps({"steps": [], "stdout": "", "error": _error_info(e)}, ensure_ascii=False)

        self.statements = _Statements(source)
        _linecache.cache[FILENAME] = (len(source), None, source.splitlines(True), FILENAME)
        user_globals = {"__name__": "__main__", "__builtins__": self._builtins()}
        depth_here = 0
        f = _sys._getframe()
        while f is not None:
            depth_here += 1
            f = f.f_back
        old_limit = _sys.getrecursionlimit()
        old_out, old_err = _sys.stdout, _sys.stderr
        _sys.stdout = _sys.stderr = self.out
        _sys.setrecursionlimit(depth_here + self.max_depth + RECURSION_HEADROOM)
        # matplotlib (Phase 36), set up before the clock starts: a no-op unless it is imported.
        self.figs.setup()
        self.deadline = _time.monotonic() + self.timeout_s
        try:
            _sys.settrace(self._global)
            try:
                exec(code, user_globals)
            finally:
                _sys.settrace(None)
        except _Abort as e:
            self.truncated = self.truncated or e.reason
        except BaseException as e:  # noqa: BLE001 - every student error is reported, not raised
            self.error = _error_info(e)
        finally:
            _sys.stdout, _sys.stderr = old_out, old_err
            _sys.setrecursionlimit(old_limit)
            self.figs.teardown()
            _linecache.cache.pop(FILENAME, None)

        rest = {"stdout": self.out.text}
        if self.error is not None:
            rest["error"] = self.error
        if self.truncated == "depth":
            pass  # reported as a RecursionError above; not a truncation
        elif self.truncated is not None:
            rest["truncated"] = self.truncated
        # '{"steps": [<snapshot>, ...], "stdout": ...}', joined from the already-serialized snapshots.
        tail = _json.dumps(rest, ensure_ascii=False)
        return '{"steps": [' + ", ".join(self.snaps) + "], " + tail[1:]


class _Walk:
    """Breadth-first walk of the objects reachable from one snapshot, in first-reached order."""

    def __init__(self, rec):
        self.rec = rec
        self.queue = []
        self.seen = set()
        self.omitted = 0

    def visit(self, oid, v):
        if oid in self.seen:
            return
        self.seen.add(oid)
        if len(self.queue) >= self.rec.max_objects:
            self.omitted += 1
            return
        self.queue.append((oid, v))

    def drain(self):
        objects = {}
        i = 0
        while i < len(self.queue):
            oid, v = self.queue[i]
            objects[oid] = self.rec._describe(v, self)
            i += 1
        return objects


def _is_ndarray(v):
    """Whether ``v`` is a NumPy ndarray (or subclass), by class name and module, without importing NumPy."""
    for k in type(v).__mro__:
        if k.__name__ == "ndarray" and (getattr(k, "__module__", "") or "").split(".")[0] == "numpy":
            return True
    return False


def _pandas_kind(v):
    """``dataframe`` / ``series`` / ``groupby`` for a pandas object of those classes (or a subclass),
    by class name and module, without importing pandas; else None (other pandas objects stay
    summaries)."""
    for k in type(v).__mro__:
        kind = PANDAS_KINDS.get(k.__name__)
        if kind is not None and (getattr(k, "__module__", "") or "").split(".")[0] == "pandas":
            return kind
    return None


def _has_user_caller(frame):
    """Whether a student frame called this one (the module body of an ``exec`` in the program has one)."""
    f = frame.f_back
    while f is not None:
        if f.f_code.co_filename == FILENAME:
            return True
        f = f.f_back
    return False


def _mpl_repr(r, tname):
    """A matplotlib object's repr, unless it shows a memory address (``<... object at 0x...>``),
    which changes from run to run: then just ``<Line2D>``."""
    return "<" + tname + ">" if " at 0x" in r else r


def _yielding(frame):
    """Whether a generator frame's ``return`` event is a ``yield`` (it will resume) or its end."""
    try:
        return _dis.opname[frame.f_code.co_code[frame.f_lasti]] == "YIELD_VALUE"
    except (IndexError, AttributeError):
        return False


def _qualname(code):
    """``Tractor.drive`` for a method, ``f`` for a function (``co_qualname`` is Python 3.11+)."""
    return getattr(code, "co_qualname", code.co_name)


def _is_dunder(name):
    return name.startswith("__") and name.endswith("__")


def _error_info(e):
    info = {"type": type(e).__name__, "message": str(e)}
    if isinstance(e, SyntaxError):
        info["message"] = e.msg or str(e)
        if e.lineno is not None:
            info["line"] = e.lineno
        if e.offset is not None:
            info["offset"] = e.offset
        info["traceback"] = "".join(_traceback.format_exception_only(type(e), e))
        return info
    user = [fs for fs in _traceback.extract_tb(e.__traceback__) if fs.filename == FILENAME]
    if user:
        info["line"] = user[-1].lineno
    info["traceback"] = (
        "Traceback (most recent call last):\n"
        + "".join(_traceback.format_list(user))
        + "".join(_traceback.format_exception_only(type(e), e))
    )
    return info


def run_json(source, stdin_json, limits_json, on_chunk=None):
    """Entry point for the worker: JSON strings in, a JSON string out (see PYTHON_TRACE_FORMAT.md).

    ``on_chunk(chunk_json, total, reason)``, when given, receives the snapshots as they are taken:
    ``chunk_json`` is a JSON array of new snapshots, ``total`` the number taken so far, and ``reason``
    the stop reason (``"steps"``, ``"time"``, ``"size"``, ``"stdout"``, ``"depth"``) on the chunk sent
    when the recorder stops the program, else ``None``. The returned JSON still holds every snapshot.
    """
    rec = _Recorder(_json.loads(stdin_json), _json.loads(limits_json), on_chunk)
    return rec.run(source)
