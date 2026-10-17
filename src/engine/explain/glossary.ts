/**
 * The concept glossary (Phase 32): one short entry per kind of step, shown in the explanation
 * panel's "Concept" section when a step has no authored concept. Entries are keyed by statement
 * kind and, where it matters, by the kind of object involved (`+=` on a dict value, `append` on a
 * list, two names sharing one list).
 *
 * This is the one reviewed file for that text. Voice: the course's — plain, short, present tense,
 * code in backticks, one idea per entry. Every entry must be true whenever its key is chosen (the
 * rules that choose a key are in `python.ts`, `conceptFor`); an entry never mentions values, so it
 * can't contradict the step it is shown on.
 *
 * @packageDocumentation
 */

export const GLOSSARY = {
  // Assignment and names
  assign:
    'Assignment makes a name refer to a value. The right-hand side is worked out first, then the name is bound to the result.',
  'assign-new-object':
    'A list, dict or set written out in the code (`[…]`, `{…}`) builds a new object each time the line runs.',
  aliasing:
    'Assignment never copies an object. After `b = a`, both names refer to the same object, so a change made through one name shows through the other.',
  unpacking:
    'Unpacking assigns several names at once: the right-hand side is worked out first, then each name gets its matching item. That is why `a, b = b, a` swaps without a temporary.',
  'augassign-number':
    '`x += 1` is short for `x = x + 1`: Python reads the current value, adds to it, and binds the name to the result. Numbers never change in place.',
  'augassign-dict':
    '`d[k] += n` reads the value stored under `k`, adds `n`, and stores the result back under the same key. If `k` is not a key yet, Python raises `KeyError` instead.',
  'augassign-list':
    '`items += more` extends the list in place, so every name that refers to that list sees the new items. `items = items + more` would build a new list instead.',
  'dict-store':
    'Assigning to `d[k]` adds the key `k` if the dict does not have it yet, and replaces its value if it does. A dict never holds the same key twice.',
  'list-store':
    'Assigning to `items[i]` replaces the item at index `i` in place. The list keeps its length.',
  'attribute-store':
    '`obj.name = value` stores an attribute on that one object. Other objects of the same class keep their own attributes.',
  annotation:
    'An annotation such as `x: int` documents the expected type. Python does not check it, and without `= value` it binds nothing.',
  // Calls and functions
  append:
    '`append` adds one item to the end of the list in place. No new list is made, so every name that refers to it sees the change.',
  'method-call':
    'A method call `obj.method(…)` runs a function that belongs to the object’s type. Some methods, such as `append`, change the object in place; others only give back a value.',
  print:
    '`print` writes text to the output. It shows a value; it does not store or return it (it returns `None`).',
  call: 'Calling a function makes a new frame for its local names. The parameters are bound to the arguments, and the caller waits until the function returns.',
  recursion:
    'A function that calls itself gets a new frame for every call, so each call has its own local names. The calls finish in reverse order.',
  'shared-argument':
    'Passing a list, dict or other object to a function passes the object itself, not a copy. The parameter and the caller’s name refer to the same object, so changes made through either show through both.',
  return:
    '`return` ends the function and hands its value back to the line that called it. A function with no `return` gives back `None`.',
  def: '`def` makes a function object and binds its name to it. The body does not run now; it runs each time the function is called.',
  class:
    '`class` runs its body once to build the class. Each object made from it later gets its own attributes, usually set in `__init__`.',
  generator:
    'A generator runs only when it is asked for its next value. It pauses at each `yield` and picks up where it left off on the next request.',
  // Control flow
  if: '`if` runs its body only when the condition is true. With `elif` and `else`, Python checks the conditions in order and runs exactly one branch at most.',
  membership:
    '`x in d` checks whether `x` is one of the dict’s keys; it does not look at the values.',
  for: 'A `for` loop takes the items of a sequence one at a time. Each pass binds the loop variable to the next item, until there are none left.',
  while:
    'A `while` loop checks its condition before every pass. When the condition is false, the loop ends and Python continues after the loop body.',
  break: '`break` leaves the innermost loop at once; the rest of the loop is skipped.',
  continue: '`continue` skips the rest of this pass and goes straight to the loop’s next pass.',
  pass: '`pass` does nothing. It holds the place of a statement where Python needs one.',
  // Exceptions
  try: 'Inside `try`, an exception stops the line that raised it and jumps to the first `except` clause that matches it. The rest of the `try` block is skipped.',
  except:
    'An `except` clause runs only when an exception of a matching type was raised in its `try` block.',
  exception:
    'An exception stops the line that raised it. Python then leaves each block and function until an `except` clause catches it; if none does, the program stops with a traceback.',
  raise:
    '`raise` starts an exception on purpose. It travels up exactly like one Python raised itself.',
  // Other statements
  import:
    '`import` runs a module once and binds a name to it, so its functions can be used with `module.name`.',
  with: '`with` sets something up and guarantees it is cleaned up afterwards, even if an exception happens inside the block.',
  delete:
    '`del name` removes the name, not the object. The object stays as long as something else still refers to it.',
  global:
    '`global` lets a function assign to a name in the global frame instead of making a local one.',
  assert:
    '`assert` checks a condition and raises `AssertionError` if it is false. When it is true, nothing happens.',
  // NumPy (Phase 34)
  'np-create':
    'A NumPy array (`ndarray`) holds values of one type (its `dtype`) in a grid of a fixed `shape`. Unlike a list, every element has the same type and the size is fixed when the array is made.',
  'np-index':
    'Indexing an array with one position per axis (`a[2]`, `m[0, 1]`) reads or writes a single element. A negative index counts from the end of that axis.',
  'np-slice-view':
    'Slicing an array (`a[1:4]`, `m[1]`, `m[:, 0]`) gives a view: a new array object that uses the same memory. Nothing is copied, so writing through the view changes the original too.',
  'np-copy':
    '`.copy()` makes an array with its own memory. Changes to the copy never show in the original, and changes to the original never show in the copy. Boolean-mask and list indexing also make copies.',
  'np-view-write':
    'A view and the array it was made from share their elements. Writing an element through either one changes it for both, because there is only one element in memory.',
  'np-elementwise':
    'Arithmetic on arrays works element by element: `a + b` adds matching elements and gives a new array. There is no loop to write, and the operands are not changed.',
  'np-broadcast':
    'Broadcasting lets arrays of different shapes combine. NumPy lines the shapes up from the right; an axis of size 1 (or a missing one) is repeated to match the other array. Shapes that do not fit raise an error.',
  'np-aggregate':
    '`sum`, `mean`, `max` and `min` with no `axis` combine every element of the array into one value.',
  'np-aggregate-axis':
    'With `axis=k`, an aggregation like `sum` combines the elements along that axis only, so that axis disappears from the shape. On a 2-D array, `axis=0` gives one result per column and `axis=1` one per row.',
  'np-reshape':
    'Reshaping gives the same values a new shape, read and filled in row by row (C order). The number of elements must stay the same; when it can, NumPy returns a view instead of copying.',
  'np-transpose':
    'Transposing (`m.T`) swaps the axes: row i becomes column i. It is a view: no values are copied, only how they are read changes.',
  'np-mask':
    'Comparing an array with a value (`a > 2`) gives a boolean array of the same shape. Indexing with it (`a[mask]`) keeps the elements where it is `True`, as a new array (a copy).',
  // pandas (Phase 35)
  'pd-read':
    '`pd.read_csv` reads a CSV file into a DataFrame: a table with one row per line of data and one column per header name. Each column gets one dtype, and an empty cell becomes a missing value, `NaN`.',
  'pd-create':
    'A DataFrame is a table: named columns, each with one dtype, and an index that labels the rows. Most DataFrame methods return a new DataFrame and leave the original unchanged.',
  'pd-series':
    'A Series is one column of values with an index: each value has a label, and `s[label]` finds it by that label, not by its position.',
  'pd-shape':
    '`df.shape` is a tuple `(rows, columns)`. It counts the whole table, not just the rows on screen.',
  'pd-head':
    '`df.head(n)` gives the first `n` rows (5 by default) as a new DataFrame; `df.tail(n)` the last ones. The rows keep their index labels.',
  'pd-info':
    '`df.info()` prints a summary of a DataFrame: how many rows, and for each column its name, how many values are not missing, and its dtype. It returns `None`.',
  'pd-column':
    '`df["col"]` selects one column as a Series. It has the same index as the DataFrame, so each value still belongs to its row.',
  'pd-columns':
    '`df[["a", "b"]]` (a list inside the brackets) selects several columns as a new DataFrame, in the order listed.',
  'pd-loc':
    '`df.loc[rows, columns]` selects by label: index labels for rows, column names for columns. A label slice such as `0:3` includes its end label.',
  'pd-iloc':
    '`df.iloc[rows, columns]` selects by position, counting from 0 like a list. A position slice such as `:2` leaves out its end position.',
  'pd-mask':
    'Comparing a column with a value (`df["x"] > 5`) gives a Series of `True` / `False` values, one per row. Used inside `df[…]`, it keeps the rows where it is `True`.',
  'pd-filter':
    '`df[condition]` keeps the rows where the condition is `True` and drops the rest, as a new DataFrame. The kept rows keep their index labels; combine conditions with `&` (and) and `|` (or), each in brackets.',
  'pd-new-column':
    'Assigning to a column that does not exist yet (`df["new"] = …`) adds it to the DataFrame in place. A calculation on columns works row by row, matching values by index label.',
  'pd-change-column':
    'Assigning to an existing column (`df["x"] = …`) replaces all its values in place. The other columns are not touched.',
  'pd-set-value':
    'Assigning to one cell (`df.loc[row, "col"] = v`, `s[label] = v`) changes that value in place. Every name that refers to that DataFrame sees the change.',
  'pd-assign':
    '`df.assign(new=…)` returns a new DataFrame with the extra column; the original DataFrame is unchanged.',
  'pd-sort':
    '`sort_values("col")` orders the rows by a column, smallest first unless `ascending=False`. Each row keeps its index label, so the labels end up out of order. With `inplace=True` it changes the DataFrame itself and returns `None`.',
  'pd-groupby':
    '`df.groupby("col")` splits the rows into groups, one per different value of `col`. It computes nothing yet: an aggregation such as `.sum()` then works on each group.',
  'pd-split-apply-combine':
    'A groupby aggregation is split, apply, combine: split the rows into groups by the key, apply the function (sum, mean, …) to each group, and combine the results into one table indexed by the key.',
  'pd-merge':
    '`pd.merge(left, right, on="key")` joins two tables row by row where the key matches. `how` decides which rows stay: `inner` only matches, `left` every left row, `right` every right row, `outer` all of them. Missing partners become `NaN`.',
  'pd-isna':
    '`df.isna()` is `True` where a value is missing (`NaN`, `None`). Followed by `.sum()`, it counts the missing values in each column, because `True` counts as 1.',
  'pd-fillna':
    '`df.fillna(value)` returns a new DataFrame with the missing values replaced; a dict fills each column with its own value. The original keeps its missing values.',
  'pd-dropna':
    '`df.dropna()` drops every row that has a missing value (with `subset=[…]`, only a missing value in those columns counts). It returns a new DataFrame unless `inplace=True`.',
  'pd-series-math':
    'Arithmetic on a Series works on every value at once and gives a new Series with the same index. Two Series are matched by index label, not by position.',
} as const;

export type ConceptKey = keyof typeof GLOSSARY;
