import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  GitBranch,
  GitMerge,
  GitCommitHorizontal,
  Search,
  Plus,
  Minus,
  Maximize2,
  ChevronDown,
  ChevronRight,
  Link2,
  ArrowUpRight,
  Pin,
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
import { CommitLedger } from './CommitLedger'
import { BranchComparison } from './BranchComparison'
import { GraphRevisionPicker, graphRevisionHash } from './GraphRevisionPicker'
import { pathToAncestor, tracePair } from '../../shared/ancestry'

import { useMapCamera, type Point } from './useMapCamera'
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
  revision,
  onRevisionChange,
  investigate,
}: {
  repo: Results['bootstrap']
  initial: Selection | null
  revision: string
  onRevisionChange: (revision: string) => void
  investigate: (s: Selection) => void
}) {
  const tip = graphRevisionHash(repo.refs, revision)
  const [line, setLine] = useState(initial?.lineage === 'first')
  const [archive, setArchive] = useState<Map<string, Commit>>()
  const [pinned, setPinned] = useState({
    base: initial?.pinBase,
    target: initial?.pinTarget,
  })
  const [stamp, setStamp] = useState('')
  const [previewReady, setPreviewReady] = useState(!isExample)
  useEffect(() => {
    if (import.meta.env.MODE === 'example')
      import('./publicHistory').then((m) => {
        if (m.snapshotRepository === `${repo.workspace}/${repo.repo}`) {
          setArchive(m.archive)
          setStamp(m.captured)
        }
        setPreviewReady(true)
      })
  }, [repo.workspace, repo.repo])
  return (
    <section className="atlas">
      <div className="atlas-title">
        <div>
          <h1>Commit graph</h1>
        </div>
        <div className="atlas-settings">
          <GraphRevisionPicker
            refs={repo.refs}
            revision={revision}
            onChange={onRevisionChange}
          />
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
      {tip && previewReady ? (
        <Canvas
          key={tip + line}
          {...{ repo, tip, line, archive, stamp, investigate }}
          initialCommit={initial?.target === tip ? initial.commit : undefined}
          pins={pinned}
          setPinned={setPinned}
        />
      ) : (
        <p>
          {tip
            ? 'Loading repository…'
            : 'This repository has no revisions yet.'}
        </p>
      )}
    </section>
  )
}

function Canvas({
  repo,
  tip,
  line,
  archive,
  stamp,
  initialCommit,
  pins: pinned,
  setPinned,
  investigate,
}: {
  repo: Results['bootstrap']
  tip: string
  line: boolean
  archive?: Map<string, Commit>
  stamp: string
  initialCommit?: string
  pins: { base: string | undefined; target: string | undefined }
  setPinned: React.Dispatch<
    React.SetStateAction<{
      base: string | undefined
      target: string | undefined
    }>
  >
  investigate: (s: Selection) => void
}) {
  const [records, setRecords] = useState(() => new Map(archive))
  const [showPaths, setShowPaths] = useState(false)
  const [root, setRoot] = useState(initialCommit || tip)
  const [selected, select] = useState(initialCommit || tip)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [offsets, setOffsets] = useState<Record<string, Point>>({})
  const [author, setAuthor] = useState('')
  const [query, search] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [share, setShare] = useState('')
  const port = useRef<HTMLDivElement>(null)
  const { camera, panTo, zoomBy, fit, reset } = useMapCamera(port)
  const { scale } = camera
  const drag = useRef<{
    id: string
    pointer: number
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
      setShowPaths(false)
      setExpanded(opened)
      setRoot(hash)
      select(hash)
      setOffsets({})
      reset()
      search('')
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
    if (showPaths) {
      await openRoot(c.hash)
      return
    }
    select(c.hash)
    setShowPaths(false)
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
  const pair = useMemo(
    () =>
      pinned.base && pinned.target
        ? tracePair(records, pinned.base, pinned.target)
        : null,
    [records, pinned],
  )
  const pairStatus = (id: string) => {
    if (id === pinned.base && id === pinned.target) return 'Both pins'
    if (id === pinned.base) return 'Baseline'
    if (id === pinned.target) return 'Target'
    if (pair?.shared.has(id)) return 'Shared'
    return undefined
  }
  async function loadAncestry() {
    if (!pair || busy) return
    const version = generation.current
    setBusy(true)
    setError('')
    try {
      const roots = pair.missing.slice(0, 3)
      const results = await Promise.allSettled(roots.map(retrieve))
      if (version !== generation.current) return
      const rows = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      )
      setRecords(
        (previous) =>
          new Map([
            ...previous,
            ...rows.map((record) => [record.hash, record] as const),
          ]),
      )
      if (results.some((result) => result.status === 'rejected'))
        setError('Some older commits could not be loaded from Bitbucket.')
    } finally {
      if (version === generation.current) setBusy(false)
    }
  }
  function pin(side: 'base' | 'target', id: string) {
    setPinned((previous) => ({ ...previous, [side]: id }))
    setShare('')
  }
  const paths = useMemo(() => {
    if (!showPaths || !pinned.base || !pinned.target || !pair?.frontier.length)
      return []
    const shared = pair.frontier[0]
    return [...new Set([pinned.base, pinned.target])].map((tip) =>
      pathToAncestor(records, tip, shared),
    )
  }, [showPaths, pinned, pair, records])
  const pathEdges = new Set(
    paths.flatMap((path) => path.slice(1).map((id, index) => path[index] + id)),
  )
  const diagramParents = (commit: Commit) =>
    paths.length
      ? commit.parents.filter((id) => pathEdges.has(commit.hash + id))
      : expanded.has(commit.hash)
        ? parents(commit)
        : []
  const layout = useMemo(() => {
    const depth = new Map<string, number>([[root, 0]]),
      ids = [root]
    if (paths.length) {
      ids.splice(0, ids.length, ...new Set(paths.flat()))
      depth.clear()
      for (const path of paths)
        path.forEach((id, index) =>
          depth.set(id, Math.max(depth.get(id) || 0, index)),
        )
    }
    for (let i = 0; !paths.length && i < ids.length; i++) {
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
  }, [root, records, expanded, offsets, line, paths])
  const byId = new Map(layout.map((n) => [n.c.hash, n]))
  const width = Math.max(550, ...layout.map((p) => p.x + W + 42)),
    height = Math.max(350, ...layout.map((p) => p.y + H + 60))
  const focus = records.get(selected)
  const [wide, setWide] = useState(false)
  const [overview, setOverview] = useState(false)
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
    if (
      drag.current ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest('button,a,input')
    )
      return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      id,
      pointer: e.pointerId,
      start: { x: e.clientX, y: e.clientY },
      origin,
      moved: false,
    }
    e.stopPropagation()
  }
  function move(e: PointerEvent) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    const x = e.clientX - d.start.x,
      y = e.clientY - d.start.y
    if (Math.abs(x) + Math.abs(y) > 4) d.moved = true
    if (d.id === 'pan') {
      if (d.moved) panTo({ x: d.origin.x + x, y: d.origin.y + y })
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
  function end(event: PointerEvent) {
    const d = drag.current
    if (d?.pointer !== event.pointerId) return
    if (d && d.id !== 'pan' && !d.moved) {
      select(d.id)
      setShare('')
    }
    drag.current = null
  }
  return (
    <>
      {pinned.base && pinned.target ? (
        <BranchComparison
          records={records}
          baseline={pinned.base}
          target={pinned.target}
          trace={(hash) => void openRoot(hash)}
          swap={() => {
            setPinned({ base: pinned.target, target: pinned.base })
            setShare('')
          }}
          clear={() => {
            setPinned({ base: undefined, target: undefined })
            setShowPaths(false)
            setShare('')
          }}
          compare={() =>
            investigate({
              base: pinned.base!,
              target: pinned.target!,
              view: 'compare',
            })
          }
          load={() => void loadAncestry()}
          showPaths={showPaths}
          togglePaths={() => {
            setOffsets({})
            setShowPaths(!showPaths)
            reset()
          }}
          busy={busy}
        />
      ) : (
        (pinned.base || pinned.target) && (
          <div className="pair-pending" role="status">
            <span>
              {pinned.base ? 'Baseline' : 'Target'}{' '}
              <code>{short((pinned.base || pinned.target)!)}</code> pinned.
              Select a second commit to complete the range.
            </span>
            <button
              onClick={() => {
                setPinned({ base: undefined, target: undefined })
                setShowPaths(false)
                setShare('')
              }}
            >
              Clear pin
            </button>
          </div>
        )
      )}
      <div className={'atlas-board' + (wide ? ' atlas-wide' : '')}>
        <div className="atlas-bar">
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
            <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
              <Minus />
            </button>
            <span>{Math.round(scale * 100)}%</span>
            <button aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
              <Plus />
            </button>
            <button aria-label="Fit map" onClick={() => fit(width, height)}>
              <Maximize2 />
            </button>
            <button aria-label="Reset map" onClick={() => void openRoot(tip)}>
              <RotateCcw />
            </button>
          </div>
        </div>
        <Dock className="atlas-body" label="Graph" split={73} single={wide}>
          <div
            className="atlas-port"
            ref={port}
            tabIndex={0}
            aria-label="Draggable commit map"
            aria-describedby="graph-gestures"
            onPointerDown={(e) => startDrag(e, 'pan', camera)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={(e) => {
              if (drag.current?.pointer === e.pointerId) drag.current = null
            }}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return
              const offsets: Record<string, Point> = {
                ArrowLeft: { x: 48, y: 0 },
                ArrowRight: { x: -48, y: 0 },
                ArrowUp: { x: 0, y: 48 },
                ArrowDown: { x: 0, y: -48 },
              }
              const delta = offsets[e.key]
              if (delta) panTo({ x: camera.x + delta.x, y: camera.y + delta.y })
              else if (e.key === '+' || e.key === '=') zoomBy(1.2)
              else if (e.key === '-') zoomBy(1 / 1.2)
              else if (e.key === '0') fit(width, height)
              else return
              e.preventDefault()
            }}
          >
            <div
              className="atlas-plane"
              style={{
                width,
                height,
                transform: `translate(${camera.x}px, ${camera.y}px) scale(${scale})`,
              }}
            >
              <svg width={width} height={height} aria-hidden="true">
                {layout.flatMap((n) =>
                  diagramParents(n.c).flatMap((p, i) => {
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
                        className={
                          paths.length ? 'pair-edge' : i ? 'merge-edge' : ''
                        }
                      />
                    )
                  }),
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
                  data-pair={pairStatus(c.hash)}
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
                  <small className="node-author">
                    {pairStatus(c.hash) || c.author}
                  </small>
                  <button
                    className="node-expand"
                    disabled={busy}
                    aria-expanded={!paths.length && expanded.has(c.hash)}
                    onClick={() => void toggle(c)}
                  >
                    {expanded.has(c.hash) ? <ChevronDown /> : <ChevronRight />}
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
          <aside className="atlas-inspector">
            <h2>Selected commit</h2>
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
                <button
                  className="atlas-inspect-changes"
                  onClick={() =>
                    investigate({
                      base: focus.parents[0] || focus.hash,
                      target: focus.hash,
                      view: 'compare',
                    })
                  }
                >
                  Open in Compare <ChevronRight size={15} />
                </button>
                <div className="pin-actions">
                  <button
                    aria-pressed={pinned.base === focus.hash}
                    onClick={() => pin('base', focus.hash)}
                  >
                    <Pin size={14} /> Pin baseline
                  </button>
                  <button
                    aria-pressed={pinned.target === focus.hash}
                    onClick={() => pin('target', focus.hash)}
                  >
                    <Pin size={14} /> Pin target
                  </button>
                </div>
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
                        pinBase: pinned.base,
                        pinTarget: pinned.target,
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
          </aside>
        </Dock>
        <footer className="atlas-footer">
          <span>
            {layout.length} visible commits · {records.size} loaded
          </span>
          <span id="graph-gestures">
            Drag the background to pan. Scroll to zoom. Dashed edges mark merge
            parents.
          </span>
        </footer>
      </div>
      <CommitLedger
        commits={layout.map((node) => node.c)}
        selected={selected}
        reveal={(id) => {
          select(id)
          setShare('')
          const position = byId.get(id)
          if (position && port.current)
            panTo({
              x: port.current.clientWidth / 2 - (position.x + W / 2) * scale,
              y: port.current.clientHeight / 2 - (position.y + H / 2) * scale,
            })
        }}
      />
      {busy && <p role="status">Loading commits…</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={() => void openRoot(root)}>Retry</button>
        </p>
      )}
      <p className="atlas-source">
        {stamp
          ? 'Public Bitbucket snapshot · ' + stamp
          : isExample
            ? 'Public Bitbucket repository'
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
import { Dock } from './components/Dock'
