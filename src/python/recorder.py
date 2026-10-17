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

import builtins as _builtins
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
# Streaming (Phase 31): snapshots are handed to the host in chunks of at most this many, or after
# this long, so a run the main thread has to kill still has the steps recorded so far.
CHUNK_MAX_SNAPSHOTS = 200
CHUNK_MAX_SECONDS = 0.1

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
        self.last_flush = 0.0
        self.keep = []  # strong refs to every object and frame seen: id() is never reused
        self.obj_ids = {}  # id(obj) -> "oN"
        self.frame_ids = {}  # id(frame) -> "fN"
        self.frame_names = {}  # "fN" -> local names in first-seen (definition) order
        self.unwinding = set()  # frame ids propagating an exception since their last line event
        self.truncated = None
        self.error = None
        self.deadline = 0.0

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
        oid = self._obj_id(v)
        walk.visit(oid, v)
        return {"kind": "ref", "id": oid}

    def _safe_repr(self, v):
        try:
            r = repr(v)
        except BaseException as e:  # noqa: BLE001 - a broken __repr__ must not stop the trace
            r = "<" + type(v).__name__ + " (repr failed: " + type(e).__name__ + ")>"
        return self._cap(r)[0]

    def _describe(self, v, walk):
        t = type(v)
        tname = t.__name__
        root = (getattr(t, "__module__", "") or "").split(".")[0]
        if root == "numpy" and hasattr(v, "shape") and hasattr(v, "dtype"):
            return {
                "kind": "summary",
                "library": "numpy",
                "type": tname,
                "shape": [int(n) for n in v.shape],
                "dtype": str(v.dtype),
            }
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
        self.last_flush = _time.monotonic()
        self._send(chunk, self.truncated if final else None)

    def _send(self, chunk, reason):
        try:
            self.on_chunk(chunk, len(self.snaps), reason)
        except Exception:  # noqa: BLE001 - a broken host callback must not break the run
            self.on_chunk = None

    def _snapshot(self, frame, event, arg):
        if len(self.snaps) >= self.max_steps:
            self._stop("steps")
        now = _time.monotonic()
        if now > self.deadline:
            self._stop("time")

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
        if event == "return":
            if fid in self.unwinding:
                snap["unwinding"] = True
            elif frame.f_code.co_flags & CO_OPTIMIZED:  # functions only; module/class bodies return None
                snap["returnValue"] = self._value(arg, walk)
        elif event == "exception":
            exc_type, exc, _tb = arg
            snap["exception"] = {"type": exc_type.__name__, "message": str(exc)}
        snap["objects"] = walk.drain()
        if walk.omitted:
            snap["objectsOmitted"] = walk.omitted
        snap["stdout"] = self.out.text
        text = _json.dumps(snap, ensure_ascii=False)
        if self.chars + len(text) > self.max_chars:
            self._stop("size")
        self.chars += len(text) + 2  # ", " between snapshots
        self.snaps.append(text)
        if self.on_chunk is not None and (
            len(self.snaps) - self.flushed >= CHUNK_MAX_SNAPSHOTS
            or now - self.last_flush >= CHUNK_MAX_SECONDS
        ):
            self._flush()

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
        self.deadline = _time.monotonic() + self.timeout_s
        self.last_flush = _time.monotonic()
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
