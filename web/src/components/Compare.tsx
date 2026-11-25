import { useMemo, useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderTree,
  GitCompareArrows,
  History,
  ListFilter,
  Search,
} from 'lucide-react'
import type { Change } from '../../../shared/types'
import { basename, dirname, pathOf, type Page } from './data'
import { Empty, Loading, More, Problem } from './Common'

const statusNames: Record<string, string> = {
  added: 'Added',
  removed: 'Deleted',
  deleted: 'Deleted',
  modified: 'Modified',
  renamed: 'Renamed',
  copied: 'Copied',
}
export function Status({
  status,
  compact = false,
}: {
  status: string
  compact?: boolean
}) {
  const name = statusNames[status.toLowerCase()] || status
  return (
    <span
      className={
        'status status-' + name.toLowerCase() + (compact ? ' compact' : '')
      }
      title={name}
      aria-label={name}
    >
      {compact ? name.charAt(0) : name}
    </span>
  )
}
function Diff({ diff }: { diff: string }) {
  const lines = useMemo(() => {
    let old = 0,
      current = 0,
      hunk = false
    const raw = diff.split(/\r?\n/)
    if (raw.at(-1) === '') raw.pop()
    const withHunks = raw.some((s) => s.startsWith('@@'))
    return raw.flatMap((line, key) => {
      const head = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (head) {
        old = +head[1]
        current = +head[2]
        hunk = true
      }
      if (withHunks && !hunk) return []
      const type = head
        ? 'hunk'
        : !hunk
          ? 'meta'
          : line.startsWith('+')
            ? 'plus'
            : line.startsWith('-')
              ? 'minus'
              : line.startsWith(' ')
                ? 'context'
                : 'meta'
      const before = type === 'minus' || type === 'context' ? old++ : ''
      const after = type === 'plus' || type === 'context' ? current++ : ''
      return [{ key, type, before, after, line }]
    })
  }, [diff])
  if (!lines.length)
    return (
      <Empty
        title="No text diff returned"
        text="The file may be unchanged, binary, or unavailable at this revision."
      />
    )
  return (
    <div
      className="diff-scroll"
      role="region"
      aria-label="Unified diff"
      tabIndex={0}
    >
      <table className="diff">
        <tbody>
          {lines.map((r) => (
            <tr className={r.type} key={r.key}>
              <td aria-label={'Baseline line ' + r.before}>{r.before}</td>
              <td aria-label={'Target line ' + r.after}>{r.after}</td>
              <td>
                <pre>{r.line || ' '}</pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
type Props = {
  comparison: Page<'compare'>
  detail: Page<'detail'>
  path: string
  select: (s: string) => void
  history: () => void
  tree: () => void
}
export function Compare({
  comparison,
  detail,
  path,
  select,
  history,
  tree,
}: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(false)
  const [closed, setClosed] = useState<string[]>([])
  const changes = comparison.data?.changes || []
  const item = changes.find((c) => pathOf(c) === path)
  const groups = new Map<string, Change[]>()
  changes
    .filter((c) =>
      [c.oldPath, c.newPath].some((p) =>
        p?.toLowerCase().includes(query.toLowerCase()),
      ),
    )
    .forEach((c) => {
      const directory = dirname(pathOf(c))
      groups.set(directory, [...(groups.get(directory) || []), c])
    })
  const added = changes.reduce((a, c) => a + c.added, 0)
  const removed = changes.reduce((a, c) => a + c.removed, 0)
  if (!comparison.data)
    return comparison.error ? (
      <Problem text={comparison.error} retry={comparison.retry} />
    ) : (
      <Loading text="Comparing revisions…" />
    )
  return (
    <section className="workspace-section">
      <div className="section-heading change-heading">
        <div className="heading-with-meta">
          <h2>Changed files</h2>
          <span className="count">
            {changes.length}
            {comparison.data.next ? '+' : ''}
          </span>
          <span className="line-stats">
            <b>+{added}</b>
            <i>−{removed}</i>
          </span>
        </div>
        <button className="button" onClick={tree}>
          <FolderTree size={15} />
          Browse source
        </button>
      </div>
      {comparison.error && (
        <Problem
          text={comparison.error}
          retry={comparison.data.next ? comparison.next : comparison.retry}
        />
      )}
      {!changes.length && !comparison.data.next ? (
        <Empty
          title="No changed files"
          text="These revisions have the same file contents. Choose another baseline or target to compare."
        />
      ) : (
        <Dock className="change-workbench" label="Compare" split={28}>
          <aside className="file-panel">
            <div className="panel-label">
              <span>File explorer</span>
              <button
                className={'icon-button' + (filter ? ' active' : '')}
                aria-label="Filter changed files"
                aria-expanded={filter}
                onClick={() => {
                  setFilter(!filter)
                  setQuery('')
                }}
              >
                <ListFilter size={17} />
              </button>
            </div>
            {filter && (
              <label className="search-field">
                <Search size={14} />
                <input
                  autoFocus
                  placeholder="Filter files…"
                  aria-label="Filter files by path"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            )}
            <div className="file-groups">
              {[...groups].map(([dir, files]) => (
                <div key={dir}>
                  {dir && (
                    <button
                      className="directory"
                      onClick={() =>
                        setClosed(
                          closed.includes(dir)
                            ? closed.filter((d) => d !== dir)
                            : [...closed, dir],
                        )
                      }
                      aria-expanded={!closed.includes(dir)}
                    >
                      {closed.includes(dir) ? (
                        <ChevronRight size={13} />
                      ) : (
                        <ChevronDown size={13} />
                      )}
                      <Folder size={15} />
                      <span>{dir}</span>
                    </button>
                  )}
                  {!closed.includes(dir) &&
                    files.map((c) => (
                      <button
                        key={pathOf(c)}
                        className={
                          'file-row ' +
                          (pathOf(c) === path ? 'selected' : '') +
                          (dir ? ' nested' : '')
                        }
                        title={pathOf(c)}
                        aria-pressed={pathOf(c) === path}
                        onClick={() => select(pathOf(c))}
                      >
                        <FileCode2 size={15} />
                        <span>{basename(pathOf(c))}</span>
                        <Status status={c.status} compact />
                      </button>
                    ))}
                </div>
              ))}
              {!groups.size && <p className="panel-note">No matching files.</p>}
            </div>
            <More
              hasNext={comparison.data.next}
              busy={comparison.busy}
              action={comparison.next}
              label="Load more files"
            />
          </aside>
          <article className="diff-panel">
            {path ? (
              <>
                <div className="diff-heading">
                  <div className="file-mark">
                    <FileCode2 size={19} />
                  </div>
                  <div className="file-title">
                    <h3>{basename(path)}</h3>
                    <code>{path}</code>
                  </div>
                  {item && <Status status={item.status} />}
                </div>
                {item?.oldPath &&
                  item?.newPath &&
                  item.oldPath !== item.newPath && (
                    <div className="rename-note">
                      <GitCompareArrows size={15} />
                      <span>
                        Renamed from <code>{item.oldPath}</code>
                      </span>
                    </div>
                  )}
                <div className="diff-toolbar">
                  <span className="micro-label">Unified diff</span>
                  {item && (
                    <span className="line-stats">
                      <b>+{item.added}</b>
                      <i>−{item.removed}</i>
                    </span>
                  )}
                </div>
                {detail.error && (
                  <Problem text={detail.error} retry={detail.retry} />
                )}
                {detail.data?.warning && (
                  <div className="notice">{detail.data.warning}</div>
                )}
                {detail.data ? (
                  <Diff diff={detail.data.diff} />
                ) : (
                  detail.busy && <Loading text="Loading file diff…" />
                )}
                <div className="diff-footer">
                  <History size={15} />
                  <button className="text-button" onClick={history}>
                    View file history <ArrowRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <Empty
                title="Select a file"
                text="Choose a changed file to inspect its diff."
              />
            )}
          </article>
        </Dock>
      )}
    </section>
  )
}
import { Dock } from './Dock'
