import { useState } from 'react'
import type { Commit } from '../../shared/types'

export function CommitLedger({
  commits,
  selected,
  reveal,
}: {
  commits: readonly Commit[]
  selected: string
  reveal: (id: string) => void
}) {
  const [all, setAll] = useState(false)
  const [merges, setMerges] = useState(false)
  const rows = commits.filter((c) => !merges || c.parents.length > 1)
  return (
    <section className="commit-ledger" aria-label="Commit ledger">
      <div className="ledger-title">
        <h2>Commit ledger</h2>
        <label>
          <input
            type="checkbox"
            checked={merges}
            onChange={(e) => setMerges(e.target.checked)}
          />{' '}
          Merges only
        </label>
        {rows.length > 5 && (
          <button aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Show first five' : 'Show all visible'}
          </button>
        )}
      </div>
      {!rows.length ? (
        <p>No {merges ? 'merges' : 'commits'} in the current map.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Commit</th>
              <th scope="col">Author</th>
              <th scope="col">Committed</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, all ? undefined : 5).map((c) => (
              <tr key={c.hash} aria-selected={c.hash === selected}>
                <td>
                  <button
                    onClick={() => reveal(c.hash)}
                    aria-pressed={c.hash === selected}
                  >
                    <code>{c.hash.slice(0, 8)}</code>
                    <span>{c.message.split('\n')[0] || 'Untitled commit'}</span>
                  </button>
                </td>
                <td>{c.author}</td>
                <td>
                  {c.date ? (
                    <time dateTime={c.date}>{c.date.slice(0, 10)}</time>
                  ) : (
                    'Unknown'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
