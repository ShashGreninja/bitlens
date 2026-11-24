import { useMemo } from 'react'
import type { Commit } from '../../shared/types'
import { tracePair } from '../../shared/ancestry'

export function BranchComparison({
  records,
  baseline,
  target,
  trace,
  compare,
  swap,
  clear,
  load,
  busy,
  showPaths,
  togglePaths,
}: {
  records: ReadonlyMap<string, Commit>
  baseline: string
  target: string
  trace: (hash: string) => void
  compare: () => void
  swap: () => void
  clear: () => void
  load: () => void
  busy: boolean
  showPaths: boolean
  togglePaths: () => void
}) {
  const result = useMemo(
    () => tracePair(records, baseline, target),
    [records, baseline, target],
  )
  const hash = (id: string) => <code>{id.slice(0, 8)}</code>
  return (
    <section className="branch-comparison" aria-label="Pinned range">
      <div className="pair-title">
        <h2>Pinned range</h2>
        <button onClick={swap} disabled={busy}>
          Swap
        </button>
        <button onClick={clear}>Clear</button>
      </div>
      <div className="pair-track">
        <button onClick={() => trace(baseline)} disabled={busy}>
          Baseline {hash(baseline)}
        </button>
        <span aria-hidden="true" className="pair-link" />
        <button onClick={() => trace(target)} disabled={busy}>
          Target {hash(target)}
        </button>
      </div>
      <dl className="pair-metrics">
        <div>
          <dt>Baseline only</dt>
          <dd>{result.leftOnly.length}</dd>
        </div>
        <div>
          <dt>Shared</dt>
          <dd>{result.shared.size}</dd>
        </div>
        <div>
          <dt>Target only</dt>
          <dd>{result.rightOnly.length}</dd>
        </div>
      </dl>
      <div className="pair-proof">
        <div>
          {result.incomplete
            ? 'Counts use loaded history.'
            : 'Both histories loaded.'}
        </div>
        {result.frontier.length ? (
          <div>
            {result.incomplete
              ? 'Newest shared commits found'
              : 'Latest common ancestors'}
            {result.frontier.map((id) => (
              <button
                key={id}
                disabled={busy}
                onClick={() => trace(id)}
                title={records.get(id)?.message}
              >
                {hash(id)}
              </button>
            ))}
          </div>
        ) : (
          <div>
            {result.incomplete
              ? 'No common ancestor found in loaded history.'
              : 'These histories have no common ancestor.'}
          </div>
        )}
      </div>
      <div className="pair-actions">
        {result.frontier.length > 0 && (
          <button aria-pressed={showPaths} onClick={togglePaths}>
            {showPaths ? 'Return to commit map' : 'Show both paths'}
          </button>
        )}
        <button onClick={compare}>Compare pinned revisions</button>
        {result.incomplete && (
          <button disabled={busy} onClick={load}>
            Load more ancestry
          </button>
        )}
      </div>
    </section>
  )
}
