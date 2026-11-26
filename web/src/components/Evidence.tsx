import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileCode2,
  Folder,
  FolderTree,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  History as HistoryIcon,
  Info,
  Network,
  Search,
} from 'lucide-react'
import type { Change, Revision } from '../../../shared/types'
import {
  basename,
  dateText,
  dirname,
  pathOf,
  short,
  usePages,
  useLocateRecord,
  type Page,
} from './data'
import { Empty, Loading, More, Problem, Source } from './Common'
import { ReplayGraph } from './ReplayGraph'
import { fixtureMode, isExample } from '../service'
import { previewUrl } from '../repositoryLocation'

export function FileHistory({
  path,
  changes,
  detail,
  selectPath,
  selected,
  selectCommit,
  graph,
}: {
  path: string
  changes: Change[]
  detail: Page<'detail'>
  selectPath: (path: string) => void
  selected?: string
  selectCommit: (hash: string) => void
  graph: (hash: string) => void
}) {
  const [input, setInput] = useState(path)
  useEffect(() => setInput(path), [path])
  const rows = detail.data?.history || []
  useLocateRecord(
    detail,
    rows.some((row) => row.hash === selected) ? undefined : selected,
  )
  return (
    <section className="workspace-section">
      <form
        className="path-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (input.trim()) selectPath(input.trim())
        }}
      >
        <label htmlFor="history-path">
          <FileCode2 size={16} />
          File path
        </label>
        <input
          id="history-path"
          list="known-paths"
          value={input}
          placeholder="Enter a repository path"
          onChange={(e) => setInput(e.target.value)}
        />
        <datalist id="known-paths">
          {changes.map((c) => (
            <option key={pathOf(c)} value={pathOf(c)} />
          ))}
        </datalist>
        <button className="button" disabled={!input.trim()}>
          <Search size={14} />
          Trace file
        </button>
      </form>
      {detail.error && (
        <Problem
          text={detail.error}
          retry={detail.data?.next ? detail.next : detail.retry}
        />
      )}
      {detail.data?.warning && (
        <div className="notice">
          <Info size={16} />
          {detail.data.warning}
        </div>
      )}
      {detail.busy && !detail.data ? (
        <Loading text="Following file history…" />
      ) : rows.length ? (
        <div className="history-list dock-single-pane">
          {rows.map((r, i) => (
            <HistoryRow
              key={r.hash + r.path}
              revision={r}
              selected={selected === r.hash}
              older={rows[i + 1]?.path}
              select={() => selectCommit(r.hash)}
              graph={() => graph(r.hash)}
            />
          ))}
        </div>
      ) : (
        !detail.error && (
          <Empty
            title={
              path ? 'No file history available' : 'Choose a file to trace'
            }
            text={
              path
                ? 'Check the path and target revision, or browse the source tree.'
                : 'Enter a path or choose a file in Compare.'
            }
          />
        )
      )}
      <More
        hasNext={detail.data?.next}
        busy={detail.busy}
        action={detail.next}
        label="Load older changes"
      />
    </section>
  )
}
function HistoryRow({
  revision: r,
  selected,
  older,
  select,
  graph,
}: {
  revision: Revision
  selected: boolean
  older?: string
  select: () => void
  graph: () => void
}) {
  return (
    <article className={'history-row' + (selected ? ' chosen' : '')}>
      <div className="timeline-dot">
        <GitCommitHorizontal size={17} />
      </div>
      <div className="history-body">
        <div className="row-top">
          <button
            className="commit-title"
            aria-pressed={selected}
            onClick={select}
          >
            {r.message.split('\n')[0] || 'Untitled commit'}
          </button>
          <code className="hash-pill">{short(r.hash)}</code>
        </div>
        <div className="metadata">
          {r.author} <span>·</span> {dateText(r.date)}
        </div>
        <div className="path-evidence">
          <FileCode2 size={14} />
          {older && older !== r.path && (
            <>
              <code>{older}</code>
              <ArrowRight size={13} />
            </>
          )}
          <code>{r.path}</code>
        </div>
        <div className="evidence-links">
          <Source url={r.url}>Commit</Source>
          <button className="text-button" onClick={graph}>
            <Network size={13} />
            View in graph
          </button>
          {r.pr && (
            <Source url={r.pr.url}>
              <GitPullRequest size={14} />
              PR #{r.pr.id} · {r.pr.title}
            </Source>
          )}
        </div>
      </div>
    </article>
  )
}

const kindNames: Record<string, string> = {
  snapshot: 'Pointer snapshot',
  create: 'Created',
  created: 'Created',
  push: 'Pushed',
  'force-push': 'Force-pushed',
  delete: 'Deleted',
  deleted: 'Deleted',
  tag: 'Tag update',
}
export const replayKindName = (kind: string) => kindNames[kind] || kind

export function Replay({
  page,
  selected,
  select,
  compare,
}: {
  page: Page<'replay'>
  selected?: string
  select: (id: string) => void
  compare: (base: string, target: string, event: string) => void
}) {
  const [showGraph, setShowGraph] = useState(false)
  const events = [...(page.data?.events || [])].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
  const index = selected
    ? events.findIndex((e) => e.id === selected)
    : events.length - 1
  const event = events[index]
  const before = event?.before
  const after = event?.after
  const example = previewUrl()
  example.search = '?fixture=1&walkthrough=replay'
  useLocateRecord(page, !event ? selected : undefined)
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <h2>Recorded events</h2>
        {page.data?.since && (
          <span className="coverage">
            <span className="point" />
            Coverage since {dateText(page.data.since)}
          </span>
        )}
      </div>
      {fixtureMode && (
        <div className="replay-example-note">
          <span>Sample repository</span>
          <a className="source-link" href={previewUrl().href}>Back to public preview</a>
        </div>
      )}
      {page.error && (
        <Problem
          text={page.error}
          retry={page.data?.next ? page.next : page.retry}
        />
      )}
      {page.data?.warning && (
        <div className="notice">
          <Info size={16} />
          {page.data.warning}
        </div>
      )}
      {page.busy && !page.data && (
        <Loading text="Loading recorded branch events…" />
      )}
      {page.data && !events.length && (
        <div className="replay-guide">
          <div>
            <HistoryIcon size={22} aria-hidden="true" />
            <h3>No recorded events yet</h3>
          </div>
          <div>
            {!isExample && <p>Coverage starts at the first observed snapshot or push.</p>}
            {isExample && !fixtureMode && <a className="source-link" href={example.href}>Open Replay example</a>}
          </div>
        </div>
      )}
      {events.length > 1 && (
        <label className="replay-scrubber">
          <span>
            Event <strong>{index < 0 ? '…' : index + 1}</strong> of{' '}
            {events.length} loaded
          </span>
          <input
            type="range"
            aria-label="Replay position"
            min={0}
            max={events.length - 1}
            value={Math.max(index, 0)}
            onChange={(e) => select(events[Number(e.target.value)].id)}
          />
        </label>
      )}
      {!!events.length && (
        <Dock className="evidence-split" label="Replay" split={43}>
          <div className="record-list">
            <div className="panel-label">
              Event timeline <span className="count">{events.length}</span>
            </div>
            {events.map((e) => (
              <button
                key={e.id}
                aria-pressed={event?.id === e.id}
                className={
                  'record-row ' + (event?.id === e.id ? 'selected' : '')
                }
                onClick={() => select(e.id)}
              >
                <HistoryIcon size={16} />
                <span>
                  <strong>{replayKindName(e.kind)}</strong>
                  <small>{e.ref}</small>
                </span>
                <small>{dateText(e.date).replace(/, \d{4}/, '')}</small>
              </button>
            ))}
          </div>
          <article className="evidence-card">
            {event ? (
              <>

                <h3>{replayKindName(event.kind)}</h3>
                <div className="ref-pill">
                  <GitBranch size={14} />
                  {event.ref}
                </div>
                <dl className="facts">
                  <dt>Recorded at</dt>
                  <dd>{dateText(event.date, true)}</dd>
                  <dt>Recorded by</dt>
                  <dd>{event.actor || 'Unavailable'}</dd>
                </dl>
                <section className="ref-movement" aria-label="Branch or tag movement">
                  <div className="pointer">
                    <span>Before</span>
                    <code>{event.before || 'No pointer recorded'}</code>
                  </div>
                  <ArrowRight className="replay-direction" size={18} aria-hidden="true" />
                  <div className="pointer">
                    <span>After</span>
                    <code>{event.after || 'No pointer recorded'}</code>
                  </div>
                </section>
                {before && after && before !== after && (
                  <button
                    className="button primary replay-compare"
                    onClick={() => compare(before, after, event.id)}
                  >
                    Compare before and after
                  </button>
                )}
                {event.gap && (
                  <div className="notice">
                    <Info size={15} />
                    Recorded pointers indicate a gap in event capture.
                  </div>
                )}
                {(event.before || event.after) && (
                  <button
                    className="button"
                    aria-expanded={showGraph}
                    onClick={() => setShowGraph(!showGraph)}
                  >
                    <Network size={15} />
                    {showGraph
                      ? 'Hide ancestry'
                      : 'Show ancestry at this event'}
                  </button>
                )}
                <div className="step-controls">
                  <button
                    className="button"
                    disabled={index <= 0}
                    onClick={() => select(events[index - 1].id)}
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>
                  <button
                    className="button"
                    disabled={index >= events.length - 1}
                    onClick={() => select(events[index + 1].id)}
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </>
            ) : (
              <Empty
                title="Event outside this page"
                text="Load more events or select a recorded event."
              />
            )}
          </article>
        </Dock>
      )}
      <More
        hasNext={page.data?.next}
        busy={page.busy}
        action={page.next}
        label="Load more events"
      />
      {showGraph && event && (event.before || event.after) && (
        <ReplayGraph key={event.id} events={events} index={index} />
      )}
    </section>
  )
}
export function Tree({
  base,
  target,
  initialPath,
  trace,
}: {
  base: string
  target: string
  initialPath: string
  trace: (path: string, hash: string) => void
}) {
  const [side, setSide] = useState<'base' | 'target'>('target')
  const [dir, setDir] = useState(initialPath)
  const hash = side === 'base' ? base : target
  const page = usePages('tree', { target: hash, path: dir }, !!hash)
  return (
    <>
      <div className="tree-controls">
        <div className="segmented">
          {(['base', 'target'] as const).map((s) => (
            <button
              className={side === s ? 'active' : ''}
              key={s}
              onClick={() => {
                setSide(s)
                setDir('')
              }}
            >
              {s === 'base' ? 'Baseline' : 'Target'}
            </button>
          ))}
        </div>
        <code>{short(hash)}</code>
      </div>
      <div className="tree-path">
        <FolderTree size={16} />
        <button className="text-button" onClick={() => setDir('')}>
          Root
        </button>
        {dir && <span>/ {dir}</span>}
      </div>
      {dir && (
        <button className="tree-entry" onClick={() => setDir(dirname(dir))}>
          <ArrowLeft size={15} />
          Parent directory
        </button>
      )}
      {page.error && (
        <Problem
          text={page.error}
          retry={page.data?.next ? page.next : page.retry}
        />
      )}
      {page.busy && !page.data && <Loading />}
      <div className="dock-single-pane">
      {page.data?.entries.map((entry) => (
        <div key={entry.path} className="tree-entry">
          {entry.directory ? (
            <>
              <Folder size={16} />
              <button className="tree-name" onClick={() => setDir(entry.path)}>
                {basename(entry.path)}
              </button>
              <ChevronRight size={14} />
            </>
          ) : (
            <>
              <FileCode2 size={16} />
              <Source className="tree-name" url={entry.url}>
                {basename(entry.path)}
              </Source>
              <button
                className="text-button"
                onClick={() => trace(entry.path, hash)}
              >
                <CircleDot size={13} />
                History
              </button>
            </>
          )}
        </div>
      ))}
      {page.data && !page.data.entries.length && (
        <Empty title="This directory is empty" />
      )}
      <More
        hasNext={page.data?.next}
        busy={page.busy}
        action={page.next}
        label="Load more entries"
      />
      </div>
    </>
  )
}
import { Dock } from './Dock'
