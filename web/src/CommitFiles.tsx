import { useEffect, useState } from 'react'
import type { Commit, Results } from '../../shared/types'
import { service, type Selection } from './service'

export function CommitFiles({
  commit,
  inspect,
}: {
  commit: Commit
  inspect: (s: Selection) => void
}) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<Results['compare']>()
  const [error, setError] = useState('')
  const [index, setIndex] = useState(0)
  const parent = commit.parents[index]
  function chooseParent(index: number) {
    setResult(undefined)
    setError('')
    setIndex(index)
  }
  useEffect(() => {
    if (!open || !parent || result) return
    let active = true
    setError('')
    service('compare', { base: parent, target: commit.hash }).then(
      (r) => {
        if (active) setResult(r)
      },
      (e) => {
        if (active) setError(String(e.message || e))
      },
    )
    return () => {
      active = false
    }
  }, [open, parent, commit.hash, result])
  if (!parent) return null
  return (
    <section className="atlas-files">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide changed files' : 'Show changed files'}
      </button>
      {open && commit.parents.length > 1 && (
        <label className="commit-parent">
          Compare against
          <select
            value={index}
            onChange={(e) => chooseParent(Number(e.target.value))}
          >
            {commit.parents.map((hash, i) => (
              <option key={hash} value={i}>
                Parent {i + 1} · {hash.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      )}
      {open &&
        (error ? (
          <p role="alert">{error}</p>
        ) : result && !result.changes.length && !result.next ? (
          <p role="status">No file changes against this parent.</p>
        ) : result ? (
          <>
            <small>
              Parent {index + 1} · {result.changes.length}
              {result.next ? ' +' : ''} files loaded
            </small>
            <button
              onClick={() =>
                inspect({ base: parent, target: commit.hash, view: 'compare' })
              }
            >
              Open full comparison
            </button>
            {result.changes.slice(0, 8).map((c) => {
              const path = c.newPath || c.oldPath || ''
              return (
                <button
                  className="atlas-file"
                  key={path}
                  onClick={() =>
                    inspect({
                      base: parent,
                      target: commit.hash,
                      path,
                      previousPath: c.oldPath || undefined,
                      fileSide: c.newPath ? undefined : 'base',
                      view: 'compare',
                    })
                  }
                >
                  <span>{path}</span>
                  <b>+{c.added}</b>
                  <em>−{c.removed}</em>
                </button>
              )
            })}
          </>
        ) : (
          <p role="status">Reading file changes…</p>
        ))}
    </section>
  )
}
