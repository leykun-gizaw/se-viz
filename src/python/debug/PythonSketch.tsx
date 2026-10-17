/**
 * Candidate B's renderer, sketched for the spike only: frames of names and an objects area keyed
 * by id, with references written as `→ o3`. It exists to show what B costs — a second renderer
 * (and, for arrows, a second overlay) next to the memory canvas — not to be used.
 */
import type { PyObject, PyValue } from '../protocol.ts';
import type { PythonStepB } from '../mappings/candidates.ts';

function Value({ value }: { value: PyValue }) {
  return value.kind === 'ref' ? (
    <span className="text-pointer">→ {value.id}</span>
  ) : (
    <span>{value.repr}</span>
  );
}

function Body({ object }: { object: PyObject }) {
  switch (object.kind) {
    case 'list':
    case 'tuple':
    case 'set':
    case 'frozenset':
      return (
        <ol className="flex flex-wrap gap-1">
          {object.items.map((v, i) => (
            <li key={i} className="rounded border border-hairline px-1.5">
              <Value value={v} />
            </li>
          ))}
        </ol>
      );
    case 'dict':
      return (
        <ul>
          {object.entries.map((e, i) => (
            <li key={i}>
              <Value value={e.key} />: <Value value={e.value} />
            </li>
          ))}
        </ul>
      );
    case 'instance':
      return (
        <ul>
          {object.attrs.map((a) => (
            <li key={a.name}>
              {a.name} = <Value value={a.value} />
            </li>
          ))}
        </ul>
      );
    case 'function':
      return <span>{`${object.name}(${object.params.join(', ')})`}</span>;
    case 'class':
      return <span>class {object.name}</span>;
    case 'summary':
      return (
        <span>{`${object.library} ${object.type} shape (${object.shape.join(', ')}) ${object.dtype}`}</span>
      );
    case 'other':
      return <span>{object.repr}</span>;
  }
}

export function PythonSketch({ step }: { step: PythonStepB }) {
  const { frames, objects } = step.python;
  return (
    <div className="flex gap-4 p-2 font-mono text-xs">
      <section className="flex min-w-40 flex-col gap-2">
        <h4 className="font-sans text-[11px] font-semibold uppercase text-ink-muted">Frames</h4>
        {[...frames].reverse().map((f) => (
          <div key={f.id} className="rounded border border-hairline bg-surface-2 p-2">
            <div className="mb-1 text-ink-muted">
              {f.name} <span className="text-ink-faint">{f.id}</span>
            </div>
            {f.vars.map((v) => (
              <div key={v.name}>
                {v.name} = <Value value={v.value} />
              </div>
            ))}
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h4 className="font-sans text-[11px] font-semibold uppercase text-ink-muted">Objects</h4>
        {objects.map(({ id, object }) => (
          <div key={id} className="rounded border border-heap p-2">
            <div className="mb-1 text-heap">
              {id} · {object.type}
            </div>
            <Body object={object} />
          </div>
        ))}
      </section>
    </div>
  );
}
