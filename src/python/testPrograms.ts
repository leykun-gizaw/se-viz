/**
 * Extra programs recorded alongside the eight samples, for decision criteria the samples don't
 * exercise on their own. Recorded into `fixtures/extra-*.json` by `recorder.test.ts`.
 */
import type { RunRequest } from './protocol.ts';

export const EXTRA_PROGRAMS: { name: string; request: RunRequest }[] = [
  {
    // Criterion 5: dict keys of every hashable primitive type, plus nested containers.
    name: 'extra-dict-keys',
    request: {
      source: [
        // `False` rather than `True`: True == 1 would share the `1` key.
        'inventory = {1: "one", 2.5: "two and a half", "corn": [3, 4], False: "no", None: {"nested": (5, 6)}}',
        'inventory["corn"].append(5)',
        'inventory[(1, 2)] = "tuple key"',
        'tags = {"b", "a", "c"}',
        '',
      ].join('\n'),
    },
  },
  {
    // Criterion 6: NumPy / pandas objects arrive as summaries. A stand-in class claiming to live in
    // `numpy` exercises the same recorder path offline (the real thing needs the CDN).
    name: 'extra-summary',
    request: {
      source: [
        'class ndarray:',
        '    shape = (2, 3)',
        '    dtype = "float64"',
        'ndarray.__module__ = "numpy"',
        'grid = ndarray()',
        'rows = [grid, grid]',
        '',
      ].join('\n'),
    },
  },
  {
    // A name rebound from a primitive to a reference (and back): the kind of its cell changes.
    name: 'extra-rebind',
    request: { source: ['x = 1', 'x = [x]', 'x = "done"', ''].join('\n') },
  },
  {
    // Phase 32: the prompt's reference breakdown, `harvest[crop] += 10` on a dict value
    // (looked up `crop`, read `harvest['beans']` (45), added 10 (55), stored it back).
    name: 'extra-augassign',
    request: {
      source: [
        'harvest = {"corn": 30, "wheat": 20, "beans": 45}',
        'for crop in harvest:',
        '    harvest[crop] += 10',
        'print(harvest)',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 32: one of each plain statement kind the derived explanations phrase.
    name: 'extra-statements',
    request: {
      source: [
        'import math',
        'from math import sqrt',
        'LIMIT: int = 3',
        'note: str',
        'def area(r):',
        '    return math.pi * r ** 2',
        'square = lambda n: n * n',
        'size = 2',
        'if size > 5:',
        '    label = "big"',
        'elif size > 1:',
        '    label = "medium"',
        'else:',
        '    label = "small"',
        'day = 0',
        'while day < LIMIT:',
        '    day += 1',
        '    if day == 2:',
        '        continue',
        '    pass',
        'else:',
        '    day = -day',
        'stock = {"corn": 3, "beans": 0}',
        'for name, qty in stock.items():',
        '    if qty == 0:',
        '        break',
        'squares = [square(n) for n in range(3)]',
        'a, b = 1, 2',
        'a, b = b, a',
        'del b',
        'assert a == 2',
        'total = sqrt(16) + area(1)',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 32: exceptions caught in the same frame, caught in a caller, and the clauses around them.
    name: 'extra-exceptions',
    request: {
      source: [
        'prices = {"corn": 3}',
        'try:',
        '    cost = prices["beans"]',
        'except KeyError as missing:',
        '    cost = 0',
        'else:',
        '    cost = cost + 1',
        'finally:',
        '    checked = True',
        'def price_of(item):',
        '    return prices[item]',
        'try:',
        '    price_of("wheat")',
        'except ValueError:',
        '    kind = "value"',
        'except KeyError:',
        '    kind = "key"',
        'try:',
        '    raise ValueError("no price")',
        'except:',
        '    kind = "any"',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 32: generators, a class with methods, a list shared with a function, and `+=` on a list.
    name: 'extra-objects',
    request: {
      source: [
        'def countdown(n):',
        '    while n > 0:',
        '        yield n',
        '        n -= 1',
        'class Barn:',
        '    def __init__(self, crops):',
        '        self.crops = crops',
        '    def store(self, crop):',
        '        self.crops.append(crop)',
        'seen = []',
        'for t in countdown(2):',
        '    seen.append(t)',
        'shelf = ["corn"]',
        'barn = Barn(shelf)',
        'barn.store("wheat")',
        'shelf += ["beans"]',
        'total = sum(x for x in seen)',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 34: the ndarray path of the recorder, offline. Stand-ins claiming to be `numpy.ndarray`
    // (and a NumPy scalar) with just the attributes the recorder reads: a 250-element array (past
    // the 200-value cap), a view of it whose memory starts 8 bytes in, and an `np.int64`-like value.
    // The real NumPy recordings come from `npm run py:record-packages` (network).
    name: 'extra-ndarray-standin',
    request: {
      source: [
        'class _Dtype:',
        '    kind = "i"',
        '    itemsize = 8',
        '    def __str__(self):',
        '        return "int64"',
        'class _Values:',
        '    def __init__(self, values):',
        '        self.values = values',
        '    def tolist(self):',
        '        return list(self.values)',
        'class _Flat:',
        '    def __init__(self, values):',
        '        self.values = values',
        '    def __getitem__(self, cut):',
        '        return _Values(self.values[cut])',
        'class _Flags:',
        '    def __init__(self, own):',
        '        self.owndata = own',
        'class ndarray:',
        '    def __init__(self, values, base=None, start=0):',
        '        self.shape = (len(values),)',
        '        self.size = len(values)',
        '        self.ndim = 1',
        '        self.dtype = _Dtype()',
        '        self.strides = (8,)',
        '        self.flat = _Flat(values)',
        '        self.base = base',
        '        self.flags = _Flags(base is None)',
        '        self.__array_interface__ = {"data": (1000 + start, False)}',
        'class int64:',
        '    ndim = 0',
        '    dtype = "int64"',
        '    def item(self):',
        '        return 7',
        'for _k in (ndarray, int64):',
        '    _k.__module__ = "numpy"',
        'big = ndarray(list(range(250)))',
        'part = ndarray([1, 2, 3], base=big, start=8)',
        'seven = int64()',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 35: the pandas path of the recorder, offline. Stand-ins claiming to be pandas'
    // `DataFrame`, `Series` and `DataFrameGroupBy`, with just the attributes the recorder reads: a
    // 22 × 13 frame (past the 20-row and 12-column caps) with missing values and a 50-character
    // string (past the 40-character cell cap), a Series with a NaN, and a GroupBy of 21 groups (past
    // the 20-group cap). The real pandas recordings come from `npm run py:record-packages`.
    name: 'extra-pandas-standin',
    request: {
      source: [
        'class _Index:',
        '    def __init__(self, labels, name=None):',
        '        self.labels, self.name = labels, name',
        '    def tolist(self):',
        '        return list(self.labels)',
        'class _Dtype(str):',
        '    pass',
        'class _List(list):',
        '    def tolist(self):',
        '        return list(self)',
        'class _Missing:',
        '    def __init__(self, columns):',
        '        self.columns = columns',
        '    def sum(self):',
        '        counts = [sum(1 for x in c if x is None or x != x) for c in self.columns]',
        '        return counts[0] if isinstance(self.columns, tuple) else _List(counts)',
        'class _ILoc:',
        '    def __init__(self, owner):',
        '        self.owner = owner',
        '    def __getitem__(self, key):',
        '        return self.owner._take(*(key if isinstance(key, tuple) else (key, slice(None))))',
        '# What the recorder reads is worked out in __getattr__: only the recorder reads it, untraced.',
        'class DataFrame:',
        '    def __init__(self, data, labels):',
        '        self.data, self.labels = data, labels',
        '    def __getattr__(self, name):',
        '        if name not in ("shape", "iloc", "index", "columns", "dtypes"):',
        '            raise AttributeError(name)',
        '        return {',
        '            "shape": lambda: (len(self.labels), len(self.data)),',
        '            "iloc": lambda: _ILoc(self),',
        '            "index": lambda: _Index(self.labels),',
        '            "columns": lambda: _Index(list(self.data)),',
        '            "dtypes": lambda: _List(_Dtype("object" if n == "note" else "int64") for n in self.data),',
        '        }[name]()',
        '    def __len__(self):',
        '        return len(self.labels)',
        '    def _take(self, rows, cols):',
        '        picked = rows if isinstance(rows, list) else list(range(len(self.labels)))[rows]',
        '        names = list(self.data)[cols]',
        '        return DataFrame({n: [self.data[n][i] for i in picked] for n in names}, [self.labels[i] for i in picked])',
        '    def isna(self):',
        '        return _Missing(list(self.data.values()))',
        '    def itertuples(self, index=False, name=None):',
        '        return [tuple(c[i] for c in self.data.values()) for i in range(len(self.labels))]',
        'class Series:',
        '    def __init__(self, values, labels, name):',
        '        self.values, self.labels, self.name = values, labels, name',
        '    dtype = "float64"',
        '    def __getattr__(self, name):',
        '        if name not in ("iloc", "index"):',
        '            raise AttributeError(name)',
        '        return {"iloc": lambda: _ILoc(self), "index": lambda: _Index(self.labels, "plot")}[name]()',
        '    def _take(self, rows, cols):',
        '        return Series(self.values[rows], self.labels[rows], self.name)',
        '    def __len__(self):',
        '        return len(self.values)',
        '    def tolist(self):',
        '        return list(self.values)',
        '    def isna(self):',
        '        return _Missing((self.values,))',
        'class DataFrameGroupBy:',
        '    def __init__(self, obj, keys, indices):',
        '        self.obj, self.keys, self.indices = obj, keys, indices',
        '        self.ngroups = len(indices)',
        'for _k in (DataFrame, Series, DataFrameGroupBy):',
        '    _k.__module__ = "pandas"',
        'names = "c0 c1 c2 c3 c4 c5 c6 c7 c8 c9 c10".split()',
        'cols = dict({"note": ["n" * 50] + [None] * 21, "k": [0, 0] + list(range(1, 21))}, **dict.fromkeys(names, list(range(22))))',
        'wide = DataFrame(cols, list(range(100, 122)))',
        'del cols, names',
        'rain = Series([0.5, float("nan")] + [1.0] * 20, list(range(22)), "rain_mm")',
        'groups = DataFrameGroupBy(wide, "k", dict(zip(range(21), [[0, 1]] + list(map(list, zip(range(2, 22)))))))',
        '',
      ].join('\n'),
    },
  },
  {
    // Phase 35: the sample data file the worker writes before every run (`src/python/data/`) is
    // there for the program, in its working directory, so `pd.read_csv("farm.csv")` works offline.
    name: 'extra-sample-data',
    request: {
      source: [
        'with open("farm.csv") as f:',
        '    header = f.readline().strip()',
        '    rows = len(f.readlines())',
        '',
      ].join('\n'),
    },
  },
];

/**
 * Phase 36: an offline stand-in for matplotlib, installed into `sys.modules` (untraced, as the
 * worker imports the real one) before {@link MATPLOTLIB_STANDIN_PROGRAMS} run. It has just what the
 * recorder uses — `pyplot` (`show`, `figure`, `get_fignums`, `close`, `switch_backend`, …),
 * `rcdefaults` / `rc_context`, `Figure` (`savefig`, `get_size_inches`, `get_axes`,
 * `get_suptitle`, `show`) and `Axes` (the chart calls, titles, labels, a legend) — and a figure's
 * `savefig` writes as many bytes as the program asks (`fig.svg_bytes`, `fig.png_bytes`), so the
 * recorder's SVG / PNG / "too large" choice, the 6-figure cap and end-of-run capture are exercised
 * on every `npm test`. The real matplotlib recordings come from `npm run py:record-packages`.
 */
export const MATPLOTLIB_STANDIN = String.raw`
import contextlib, sys, types, warnings

mpl = types.ModuleType("matplotlib")
mpl.__path__ = []
mpl.rcParams = {}
log = []  # (figure number, format) for each savefig call

def rcdefaults():
    mpl.rcParams.clear()
    log.append(("rcdefaults", None))

@contextlib.contextmanager
def rc_context(params):
    old = dict(mpl.rcParams)
    mpl.rcParams.update(params)
    try:
        yield
    finally:
        mpl.rcParams.clear()
        mpl.rcParams.update(old)

mpl.rcdefaults = rcdefaults
mpl.rc_context = rc_context
mpl.get_backend = lambda: "agg"
mpl.log = log

class Legend:
    def __init__(self, labels):
        self.labels = labels
    def get_texts(self):
        return [types.SimpleNamespace(get_text=(lambda t=t: t)) for t in self.labels]

class Axes:
    def __init__(self, fig):
        self.figure = fig
        self.text = {"title": "", "xlabel": "", "ylabel": ""}
        self.legend_ = None
    def plot(self, *args, **kwargs):
        return []
    def scatter(self, *args, **kwargs):
        return None
    def bar(self, *args, **kwargs):
        return None
    def hist(self, values, bins=10, **kwargs):
        self.bar(values, values)  # like matplotlib: a histogram is drawn with bars
        return None
    def pie(self, *args, **kwargs):
        return None
    def set_title(self, t):
        self.text["title"] = t
    def set_xlabel(self, t):
        self.text["xlabel"] = t
    def set_ylabel(self, t):
        self.text["ylabel"] = t
    def get_title(self):
        return self.text["title"]
    def get_xlabel(self):
        return self.text["xlabel"]
    def get_ylabel(self):
        return self.text["ylabel"]
    def legend(self, labels):
        self.legend_ = Legend(labels)
    def get_legend(self):
        return self.legend_

class Figure:
    def __init__(self, number, figsize=(6.4, 4.8)):
        self.number = number
        self.size = figsize
        self.axes_ = []
        self.sup = ""
        self.svg_bytes = 600
        self.png_bytes = 300
        self.fail = False
    def get_size_inches(self):
        return self.size
    def get_axes(self):
        return list(self.axes_)
    def get_suptitle(self):
        return self.sup
    def suptitle(self, t):
        self.sup = t
    def add_axes(self):
        ax = Axes(self)
        self.axes_.append(ax)
        return ax
    def savefig(self, buf, format=None, dpi=None, metadata=None):
        log.append((self.number, format if format != "svg" else "svg:" + str(mpl.rcParams.get("svg.fonttype"))))
        warnings.warn("stand-in rendering warning")  # must not reach the program's output
        if self.fail:
            raise ValueError("cannot draw")
        if format == "svg":
            head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d"><rect width="4" height="4"/><!--' % (self.size[0] * 72, self.size[1] * 72)
            tail = "--></svg>"
            buf.write((head + "x" * max(0, self.svg_bytes - len(head) - len(tail)) + tail).encode())
        else:
            buf.write(b"\x89PNG" + b"0" * max(0, self.png_bytes - 4))
    def show(self):
        print("the stand-in's own Figure.show ran")

for k in (Legend, Axes):
    k.__module__ = "matplotlib.axes"
Figure.__module__ = "matplotlib.figure"

plt = types.ModuleType("matplotlib.pyplot")
figs = {}
current = [None]

def figure(num=None, figsize=(6.4, 4.8)):
    if num is not None and num in figs:
        current[0] = figs[num]
        return figs[num]
    n = num if num is not None else (max(figs) + 1 if figs else 1)
    f = Figure(n, figsize)
    figs[n] = f
    current[0] = f
    return f

def gcf():
    return current[0] if current[0] is not None and current[0].number in figs else figure()

def gca():
    f = gcf()
    return f.axes_[0] if f.axes_ else f.add_axes()

def subplots(nrows=1, ncols=1, figsize=(6.4, 4.8)):
    f = figure(figsize=figsize)
    axs = [f.add_axes() for _ in range(nrows * ncols)]
    return f, (axs[0] if len(axs) == 1 else axs)

def close(which=None):
    if which is None or which == "all":
        figs.clear()
        current[0] = None
    else:
        figs.pop(which.number, None)

def show():
    print("the stand-in's own show ran")

plt.figure = figure
plt.gcf = gcf
plt.gca = gca
plt.subplots = subplots
plt.close = close
plt.show = show
plt.get_fignums = lambda: sorted(figs)
plt.switch_backend = lambda name: None
plt.plot = lambda *a, **k: gca().plot(*a, **k)
plt.scatter = lambda *a, **k: gca().scatter(*a, **k)
plt.bar = lambda *a, **k: gca().bar(*a, **k)
plt.hist = lambda *a, **k: gca().hist(*a, **k)
plt.title = lambda t: gca().set_title(t)
plt.xlabel = lambda t: gca().set_xlabel(t)
plt.ylabel = lambda t: gca().set_ylabel(t)

axes_mod = types.ModuleType("matplotlib.axes")
axes_mod.Axes = Axes
figure_mod = types.ModuleType("matplotlib.figure")
figure_mod.Figure = Figure
mpl.pyplot = plt
mpl.axes = axes_mod
mpl.figure = figure_mod
sys.modules.update({
    "matplotlib": mpl,
    "matplotlib.pyplot": plt,
    "matplotlib.axes": axes_mod,
    "matplotlib.figure": figure_mod,
})
`;

/** Phase 36: programs run against {@link MATPLOTLIB_STANDIN}. */
export const MATPLOTLIB_STANDIN_PROGRAMS: { name: string; request: RunRequest }[] = [
  {
    // Every format choice, the 6-figure cap, Figure.show, and a figure that fails to draw.
    name: 'extra-matplotlib-standin',
    request: {
      source: [
        'import matplotlib.pyplot as plt',
        'small = plt.figure()',
        'plt.plot([1, 2, 3])',
        'plt.title("small")',
        'plt.show()',
        'big = plt.figure()',
        'big.svg_bytes = 400 * 1024',
        'big.png_bytes = 2000',
        'plt.hist([1, 2, 2, 3])',
        'huge = plt.figure(figsize=(40, 40))',
        'huge.svg_bytes = 400 * 1024',
        'heavy = plt.figure()',
        'heavy.svg_bytes = 400 * 1024',
        'heavy.png_bytes = 400 * 1024',
        'plt.show()',
        'broken = plt.figure()',
        'broken.fail = True',
        'broken.show()',
        'for i in range(3):',
        '    fig, ax = plt.subplots()',
        '    ax.scatter([i], [i])',
        '    ax.set_xlabel("x")',
        '    plt.show()',
        'print("done")',
        '',
      ].join('\n'),
    },
  },
  {
    // Figures still open at the end, two axes with a legend and a suptitle, and a function call.
    name: 'extra-matplotlib-end',
    request: {
      source: [
        'import matplotlib.pyplot as plt',
        'def draw(values):',
        '    plt.bar(["a", "b"], values)',
        '    plt.ylabel("kg")',
        'fig, (left, right) = plt.subplots(1, 2)',
        'left.plot([1, 2])',
        'left.legend(["rain"])',
        'right.pie([1, 2])',
        'fig.suptitle("Two charts")',
        'draw([3, 4])',
        'plt.figure()',
        'plt.bar(["c"], [5])',
        '',
      ].join('\n'),
    },
  },
];
