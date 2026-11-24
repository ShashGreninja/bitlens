import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  GitBranch,
  GitMerge,
  GitCommitHorizontal,
  Network,
  Search,
  Plus,
  Minus,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Link2,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react'
import type { Commit, Results } from '../../shared/types'
import {
  isExample,
  service,
  openSource,
  shareInvestigation,
  type Selection,
} from './service'
import './atlas.css'
import { CommitFiles } from './CommitFiles'

type Point = { x: number; y: number }
const W = 244,
  H = 124
const short = (s: string) => s.slice(0, 8)
const day = (s: string) =>
  new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
const label = (c: Commit) => c.message.split('\n')[0]
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function Atlas({
  repo,
  initial,
  investigate,
}: {
  repo: Results['bootstrap']
  initial: Selection | null
  investigate: (s: Selection) => void
}) {
  const [tip, setTip] = useState(
    initial?.target ||
      repo.refs.find((r) => r.name === repo.defaultBranch)?.hash ||
      repo.refs[0]?.hash ||
      '',
  )
  const [line, setLine] = useState(initial?.lineage === 'first')
  const [archive, setArchive] = useState<Map<string, Commit>>()
  const [stamp, setStamp] = useState('')
  useEffect(() => {
    if (isExample)
      import('./publicHistory').then((m) => {
        setArchive(m.archive)
        setStamp(m.captured)
      })
  }, [])
  return (
    <main className="atlas">
      <header className="atlas-head">
        <div>
          <Network />
          Repository History
        </div>
        <span>Bitbucket Cloud</span>
      </header>
      <div className="atlas-title">
        <div>
          <span className="atlas-repo">
            {repo.workspace} / {repo.repo}
          </span>
          <h1>History explorer</h1>
        </div>
        <div className="atlas-settings">
          <label>
            Starting revision
            <select
              aria-label="Starting revision"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
            >
              {!repo.refs.some((r) => r.hash === tip) && tip && (
                <option value={tip}>{short(tip)}</option>
              )}
              {repo.refs.map((r) => (
                <option key={r.kind + r.name} value={r.hash}>
                  {r.kind} · {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Follow
            <select
              aria-label="Follow"
              value={line ? 'first' : 'all'}
              onChange={(e) => setLine(e.target.value === 'first')}
            >
              <option value="all">All parents</option>
              <option value="first">First parent</option>
            </select>
          </label>
        </div>
      </div>
      {tip && (!isExample || archive) ? (
        <Canvas
          key={tip + line}
          {...{ repo, tip, line, archive, stamp, investigate }}
          initialCommit={initial?.target === tip ? initial.commit : undefined}
        />
      ) : (
        <p>
          {tip
            ? 'Loading repository…'
            : 'This repository has no revisions yet.'}
        </p>
      )}
    </main>
  )
}

function Canvas({
  repo,
  tip,
  line,
  archive,
  stamp,
  initialCommit,
  investigate,
}: {
  repo: Results['bootstrap']
  tip: string
  line: boolean
  archive?: Map<string, Commit>
  stamp: string
  initialCommit?: string
  investigate: (s: Selection) => void
}) {
  const [records, setRecords] = useState(() => new Map(archive))
  const [root, setRoot] = useState(initialCommit || tip)
  const [selected, select] = useState(initialCommit || tip)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [offsets, setOffsets] = useState<Record<string, Point>>({})
  const [scale, zoom] = useState(1)
  const [author, setAuthor] = useState('')
  const [query, search] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [share, setShare] = useState('')
  const port = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: string
    start: Point
    origin: Point
    moved: boolean
  } | null>(null)
  const generation = useRef(0)
  const requests = useRef(new Map<string, Promise<Commit[]>>())
  const parents = (c: Commit) => (line ? c.parents.slice(0, 1) : c.parents)
  async function retrieve(id: string): Promise<Commit[]> {
    const found = records.get(id) || archive?.get(id)
    if (found) return [found]
    let req = requests.current.get(id)
    if (!req) {
      req = service('graph', { base: id, target: id })
        .then((r) => {
          if (!r.commits.some((c) => c.hash === id))
            throw Error('Bitbucket could not return this commit.')
          return r.commits
        })
        .finally(() => requests.current.delete(id))
      requests.current.set(id, req)
    }
    return req
  }
  async function openRoot(hash: string) {
    const version = ++generation.current
    setBusy(true)
    setError('')
    setShare('')
    try {
      const first = await retrieve(hash)
      const start = first.find((c) => c.hash === hash)!
      const gathered = new Map(first.map((c) => [c.hash, c]))
      const add = async (id: string) => {
        if (!gathered.has(id))
          for (const c of await retrieve(id)) gathered.set(c.hash, c)
      }
      await Promise.all(parents(start).map(add))
      const opened = new Set([hash])
      for (const id of parents(start)) {
        const c = gathered.get(id)!
        await Promise.all(parents(c).map(add))
        opened.add(id)
      }
      if (version !== generation.current) return
      setRecords((old) => new Map([...old, ...gathered]))
      setExpanded(opened)
      setRoot(hash)
      select(hash)
      setOffsets({})
      zoom(1)
      search('')
      port.current?.scrollTo(0, 0)
    } catch (e) {
      if (version === generation.current) setError(errorText(e))
    } finally {
      if (version === generation.current) setBusy(false)
    }
  }
  useEffect(() => {
    void openRoot(initialCommit || tip)
    return () => {
      generation.current++
    }
  }, [])
  async function toggle(c: Commit) {
    select(c.hash)
    setShare('')
    if (expanded.has(c.hash)) {
      setExpanded((old) => {
        const next = new Set(old)
        next.delete(c.hash)
        return next
      })
      return
    }
    const version = generation.current
    setBusy(true)
    setError('')
    try {
      const rows = (await Promise.all(parents(c).map(retrieve))).flat()
      if (version !== generation.current) return
      setRecords(
        (old) => new Map([...old, ...rows.map((r) => [r.hash, r] as const)]),
      )
      setExpanded((old) => new Set(old).add(c.hash))
    } catch (e) {
      if (version === generation.current) setError(errorText(e))
    } finally {
      if (version === generation.current) setBusy(false)
    }
  }
  const layout = useMemo(() => {
    const depth = new Map<string, number>([[root, 0]]),
      ids = [root]
    for (let i = 0; i < ids.length; i++) {
      const c = records.get(ids[i])
      if (!c || !expanded.has(c.hash)) continue
      for (const p of parents(c))
        if (!depth.has(p)) {
          depth.set(p, depth.get(c.hash)! + 1)
          ids.push(p)
        }
    }
    const lanes = new Map<number, number>()
    const nodes = ids.flatMap((id) => {
      const c = records.get(id)
      if (!c) return []
      const col = depth.get(id)!,
        lane = lanes.get(col) || 0
      lanes.set(col, lane + 1)
      return [
        {
          c,
          ...(offsets[id] || {
            x: 32 + col * 305,
            y: 52 + lane * 164 + (col === 0 ? 54 : 0),
          }),
        },
      ]
    })
    return nodes
  }, [root, records, expanded, offsets, line])
  const byId = new Map(layout.map((n) => [n.c.hash, n]))
  const width = Math.max(550, ...layout.map((p) => p.x + W + 42)),
    height = Math.max(350, ...layout.map((p) => p.y + H + 60))
  const focus = records.get(selected)
  const [wide, setWide] = useState(false)
  const [overview, setOverview] = useState(true)
  const matches = query.trim()
    ? [...records.values()]
        .filter((c) =>
          (c.hash + ' ' + c.message + ' ' + c.author)
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .slice(0, 8)
    : []
  function startDrag(e: PointerEvent<HTMLElement>, id: string, origin: Point) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,a,input'))
      return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      id,
      start: { x: e.clientX, y: e.clientY },
      origin,
      moved: false,
    }
    e.stopPropagation()
  }
  function move(e: PointerEvent) {
    const d = drag.current
    if (!d || !port.current) return
    const x = e.clientX - d.start.x,
      y = e.clientY - d.start.y
    if (Math.abs(x) + Math.abs(y) > 4) d.moved = true
    if (d.id === 'pan') {
      port.current.scrollTo(d.origin.x - x, d.origin.y - y)
      return
    }
    if (d.moved)
      setOffsets((old) => ({
        ...old,
        [d.id]: {
          x: Math.max(8, d.origin.x + x / scale),
          y: Math.max(8, d.origin.y + y / scale),
        },
      }))
  }
  function end() {
    const d = drag.current
    if (d && d.id !== 'pan' && !d.moved) {
      select(d.id)
      setShare('')
    }
    drag.current = null
  }
  function fit() {
    if (port.current) {
      zoom(
        Math.min(
          1.35,
          port.current.clientWidth / width,
          port.current.clientHeight / height,
        ),
      )
      port.current.scrollTo(0, 0)
    }
  }
  return (
    <>
      <div className={'atlas-board' + (wide ? ' atlas-wide' : '')}>
        <div className="atlas-bar">
          <h2>
            <GitBranch size={18} />
            Commit map
          </h2>
          <div className="atlas-search">
            <Search size={16} />
            <input
              aria-label="Search loaded commits"
              placeholder="Search commits or authors"
              value={query}
              onChange={(e) => search(e.target.value)}
            />
            {query && (
              <div className="atlas-results">
                {matches.length
                  ? matches.map((c) => (
                      <button
                        key={c.hash}
                        onClick={() => void openRoot(c.hash)}
                      >
                        {short(c.hash)} · {label(c)}
                      </button>
                    ))
                  : 'No matching loaded commits'}
              </div>
            )}
          </div>
          <div className="atlas-tools">
            <button
              className="atlas-wide-button"
              aria-pressed={wide}
              onClick={() => setWide(!wide)}
            >
              {wide ? 'Exit focus' : 'Focus map'}
            </button>
            <button
              aria-label="Zoom out"
              onClick={() => zoom(Math.max(0.25, scale - 0.15))}
            >
              <Minus />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button
              aria-label="Zoom in"
              onClick={() => zoom(Math.min(2, scale + 0.15))}
            >
              <Plus />
            </button>
            <button aria-label="Fit map" onClick={fit}>
              <Maximize2 />
            </button>
            <button aria-label="Reset map" onClick={() => void openRoot(tip)}>
              <RotateCcw />
            </button>
          </div>
        </div>
        <div className="atlas-body">
          <div
            className="atlas-port"
            ref={port}
            tabIndex={0}
            aria-label="Draggable commit map"
            onPointerDown={(e) =>
              startDrag(e, 'pan', {
                x: e.currentTarget.scrollLeft,
                y: e.currentTarget.scrollTop,
              })
            }
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={() => (drag.current = null)}
          >
            <div
              style={{
                width: width * scale,
                height: height * scale,
                position: 'relative',
              }}
            >
              <div
                className="atlas-plane"
                style={{ width, height, transform: 'scale(' + scale + ')' }}
              >
                <svg width={width} height={height} aria-hidden="true">
                  {layout.flatMap((n) =>
                    expanded.has(n.c.hash)
                      ? parents(n.c).flatMap((p, i) => {
                          const dest = byId.get(p)
                          if (!dest) return []
                          const x = n.x + W,
                            y = n.y + H / 2,
                            to = dest.y + H / 2,
                            mid = (x + dest.x) / 2
                          return (
                            <path
                              key={n.c.hash + p}
                              d={`M ${x} ${y} C ${mid} ${y}, ${mid} ${to}, ${dest.x} ${to}`}
                              className={i ? 'merge-edge' : ''}
                            />
                          )
                        })
                      : [],
                  )}
                </svg>
                {layout.map(({ c, x, y }) => (
                  <article
                    key={c.hash}
                    className={
                      'atlas-node ' + (selected === c.hash ? 'chosen' : '')
                    }
                    data-hash={c.hash}
                    data-muted={Boolean(author && author !== c.author)}
                    style={{ left: x, top: y, width: W, height: H }}
                    onPointerDown={(e) => startDrag(e, c.hash, { x, y })}
                  >
                    <div className="node-id">
                      {c.parents.length > 1 ? (
                        <GitMerge size={14} />
                      ) : (
                        <GitCommitHorizontal size={14} />
                      )}
                      <code>{short(c.hash)}</code>
                      <span>
                        {repo.refs.find((r) => r.hash === c.hash)?.name}
                      </span>
                    </div>
                    <button
                      title={label(c)}
                      className="node-title"
                      onClick={() => {
                        select(c.hash)
                        setShare('')
                      }}
                    >
                      {label(c)}
                    </button>
                    <small className="node-author">{c.author}</small>
                    <button
                      className="node-expand"
                      disabled={busy}
                      aria-expanded={expanded.has(c.hash)}
                      onClick={() => void toggle(c)}
                    >
                      {expanded.has(c.hash) ? (
                        <ChevronDown />
                      ) : (
                        <ChevronRight />
                      )}
                      {c.parents.length
                        ? parents(c).length +
                          ' parent' +
                          (parents(c).length === 1 ? '' : 's')
                        : 'Root details'}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <aside className="atlas-inspector">
            <button
              className="overview-toggle"
              aria-expanded={overview}
              onClick={() => setOverview(!overview)}
            >
              Map overview <ChevronDown size={13} />
            </button>
            {overview && (
              <svg
                className="atlas-mini"
                viewBox={`0 0 ${width} ${height}`}
                aria-label="Map overview"
              >
                {layout.flatMap((n) =>
                  expanded.has(n.c.hash)
                    ? parents(n.c).flatMap((p) => {
                        const d = byId.get(p)
                        return d
                          ? [
                              <line
                                key={n.c.hash + p}
                                x1={n.x + W / 2}
                                y1={n.y + H / 2}
                                x2={d.x + W / 2}
                                y2={d.y + H / 2}
                              />,
                            ]
                          : []
                      })
                    : [],
                )}
                {layout.map((n) => (
                  <rect
                    key={n.c.hash}
                    x={n.x}
                    y={n.y}
                    width={W}
                    height={H}
                    rx="12"
                    fill={selected === n.c.hash ? '#8fe4c1' : '#9aaea9'}
                  >
                    <title>{label(n.c)}</title>
                  </rect>
                ))}
              </svg>
            )}
            <h2>Commit details</h2>
            {focus && (
              <>
                <code>{short(focus.hash)}</code>
                <h3>{label(focus)}</h3>
                <dl>
                  <dt>Author</dt>
                  <dd>
                    <button
                      className="author-focus"
                      aria-pressed={author === focus.author}
                      title="Highlight this author on the map"
                      onClick={() =>
                        setAuthor(author === focus.author ? '' : focus.author)
                      }
                    >
                      {focus.author}
                    </button>
                  </dd>
                  <dt>Committed</dt>
                  <dd>{day(focus.date)}</dd>
                  <dt>Parents</dt>
                  <dd>{focus.parents.length || 'Root commit'}</dd>
                </dl>
                {focus.message.includes('\n') && (
                  <details>
                    <summary>Full message</summary>
                    <pre>{focus.message}</pre>
                  </details>
                )}
                <CommitFiles
                  key={focus.hash}
                  commit={focus}
                  inspect={investigate}
                />
                <button onClick={() => void openRoot(focus.hash)}>
                  Trace from this commit
                </button>
                <button
                  onClick={() =>
                    investigate({
                      base: focus.parents[0] || focus.hash,
                      target: focus.hash,
                      view: 'compare',
                    })
                  }
                >
                  Inspect changed files
                </button>
                <button
                  onClick={() =>
                    openSource(focus.url).catch((e) => setError(errorText(e)))
                  }
                >
                  Open in Bitbucket <ArrowUpRight size={15} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      const url = await shareInvestigation({
                        base: tip,
                        target: tip,
                        commit: focus.hash,
                        view: 'graph',
                        lineage: line ? 'first' : 'all',
                      })
                      setShare(url)
                      await navigator.clipboard?.writeText(url)
                    } catch (e) {
                      setError(errorText(e))
                    }
                  }}
                >
                  <Link2 size={15} /> Share graph
                </button>
                {share && (
                  <input
                    aria-label="Graph link"
                    value={share}
                    readOnly
                    onFocus={(e) => e.target.select()}
                  />
                )}
              </>
            )}
          </aside>
        </div>
        <footer>
          <span>
            {layout.length} visible commits · {records.size} loaded
          </span>
          <span>
            Dashed edges mark merge parents. Drag cards to move them. Expand its
            parents to trace history.
          </span>
        </footer>
      </div>
      {busy && <p role="status">Loading commits…</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void openRoot(root)}>Retry</button>
        </p>
      )}
      <p className="atlas-source">
        {stamp
          ? 'Public Bitbucket snapshot · ' + stamp
          : 'Connected Bitbucket repository'}{' '}
        ·{' '}
        <a
          href={repo.webUrl}
          onClick={(e) => {
            e.preventDefault()
            openSource(repo.webUrl).catch((err) => setError(errorText(err)))
          }}
        >
          {repo.workspace}/{repo.repo}
        </a>
      </p>
    </>
  )
}
