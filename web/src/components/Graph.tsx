import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import {
  Expand,
  GitBranch,
  GitCommitHorizontal,
  Minus,
  Plus,
  Tag,
} from 'lucide-react'
import type { Commit, Ref } from '../../../shared/types'
import { dateText, short, useLocateRecord, type Page } from './data'
import { Empty, Loading, More, Problem, Source } from './Common'

function graphElements(
  commits: Commit[],
  base: string,
  target: string,
  refs: Ref[],
): cytoscape.ElementDefinition[] {
  const known = new Map(commits.map((c) => [c.hash, c]))
  const children = new Map<string, number>()
  for (const c of commits)
    for (const p of c.parents) children.set(p, (children.get(p) || 0) + 1)
  const queue = commits.filter((c) => !children.get(c.hash)).map((c) => c.hash)
  const depth = new Map<string, number>()
  // A parent receives its level after every visible child has contributed.
  for (let i = 0; i < queue.length; i++) {
    const hash = queue[i]
    for (const p of known.get(hash)?.parents || []) {
      depth.set(p, Math.max(depth.get(p) || 0, (depth.get(hash) || 0) + 1))
      children.set(p, (children.get(p) || 0) - 1)
      if (!children.get(p)) queue.push(p)
    }
  }
  const levels = new Map<number, string[]>()
  queue.forEach((hash) => {
    const level = depth.get(hash) || 0
    levels.set(level, [...(levels.get(level) || []), hash])
  })
  const nodes: cytoscape.ElementDefinition[] = []
  levels.forEach((hashes, level) =>
    hashes.forEach((hash, i) => {
      const ref =
        refs.find((r) => r.hash === hash && r.kind === 'tag') ||
        refs.find((r) => r.hash === hash)
      nodes.push({
        data: { id: hash, label: short(hash) + (ref ? ' · ' + ref.name : '') },
        position: { x: (i - (hashes.length - 1) / 2) * 145, y: level * 72 },
        classes: [
          known.has(hash) ? 'known' : 'boundary',
          hash === target ? 'target' : '',
          hash === base ? 'base' : '',
        ].join(' '),
      })
    }),
  )
  return [
    ...nodes,
    ...commits.flatMap((c) =>
      c.parents.map((p) => ({
        data: { id: c.hash + '-' + p, source: c.hash, target: p },
      })),
    ),
  ]
}
export default function Graph({
  page,
  base,
  target,
  refs,
  selected,
  select,
}: {
  page: Page<'graph'>
  base: string
  target: string
  refs: Ref[]
  selected?: string
  select: (hash: string) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const cy = useRef<cytoscape.Core | null>(null)
  const onSelect = useRef(select)
  onSelect.current = select
  const commits = useMemo(
    () => [
      ...new Map((page.data?.commits || []).map((c) => [c.hash, c])).values(),
    ],
    [page.data],
  )
  const hash = selected || target
  const commit = commits.find((c) => c.hash === hash)
  useLocateRecord(page, !commit ? selected : undefined)
  const elements = useMemo(
    () => graphElements(commits, base, target, refs),
    [commits, base, target, refs],
  )
  const [graphError, setGraphError] = useState('')
  useEffect(() => {
    if (!el.current || !elements.length) return
    let ro: ResizeObserver | undefined
    try {
      const instance = cytoscape({
        container: el.current,
        elements,
        layout: { name: 'preset', padding: 36 },
        minZoom: 0.12,
        maxZoom: 2.5,
        wheelSensitivity: 0.25,
        autoungrabify: true,
        boxSelectionEnabled: false,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#3a7771',
              width: 13,
              height: 13,
              label: 'data(label)',
              'font-family': 'monospace',
              'font-size': 11,
              color: '#273c3c',
              'text-valign': 'center',
              'text-halign': 'right',
              'text-margin-x': 8,
              'text-background-opacity': 0.92,
              'text-background-color': '#f7faf8',
              'text-background-padding': '2px',
            },
          },
          {
            selector: '.boundary',
            style: { 'background-color': '#a9b6b3', width: 9, height: 9 },
          },
          {
            selector: '.base',
            style: { 'background-color': '#7b60a5', width: 17, height: 17 },
          },
          {
            selector: '.target',
            style: { 'background-color': '#009479', width: 17, height: 17 },
          },
          {
            selector: '.chosen',
            style: { 'border-color': '#213d38', 'border-width': 3 },
          },
          {
            selector: 'edge',
            style: {
              width: 2,
              'line-color': '#93b3a8',
              'target-arrow-color': '#93b3a8',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.65,
              'curve-style': 'bezier',
            },
          },
        ],
      })
      cy.current = instance
      instance.on('tap', 'node', (e) => onSelect.current(e.target.id()))
      ro = new ResizeObserver(() => {
        instance.resize()
        instance.fit(undefined, 32)
      })
      ro.observe(el.current)
      setGraphError('')
    } catch {
      setGraphError(
        'The graph could not be drawn. The commit list below contains the same ancestry records.',
      )
    }
    return () => {
      ro?.disconnect()
      cy.current?.destroy()
      cy.current = null
    }
  }, [elements])
  useEffect(() => {
    cy.current?.nodes().removeClass('chosen')
    cy.current?.getElementById(hash).addClass('chosen')
  }, [hash, elements])
  const zoom = (factor: number) => {
    const c = cy.current
    if (c)
      c.zoom({
        level: c.zoom() * factor,
        renderedPosition: { x: c.width() / 2, y: c.height() / 2 },
      })
  }
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <h2>Commit ancestry</h2>
        <span className="subtle">{commits.length} commits loaded</span>
      </div>
      {page.error && (
        <Problem
          text={page.error}
          retry={page.data?.next ? page.next : page.retry}
        />
      )}
      {page.busy && !page.data && <Loading text="Loading commit ancestry…" />}
      {page.data && !commits.length && (
        <Empty
          title="No commits available"
          text="Choose an accessible revision to inspect its ancestry."
        />
      )}
      {!!commits.length && (
        <>
          <div className="graph-layout">
            <div className="graph-canvas">
              <div
                ref={el}
                className="graph-drawing"
                role="img"
                aria-label="Commit ancestry diagram. Arrows point to parents. Select commits using the list below."
              />
              <div className="graph-tools">
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  onClick={() => zoom(1.25)}
                >
                  <Plus size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  onClick={() => zoom(0.8)}
                >
                  <Minus size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Fit graph"
                  onClick={() => cy.current?.fit(undefined, 32)}
                >
                  <Expand size={14} />
                </button>
              </div>
            </div>
            <article className="evidence-card">
              <div className="micro-label">Selected commit</div>
              <code className="large-hash">{short(hash)}</code>
              {commit ? (
                <>
                  <h3>{commit.message.split('\n')[0]}</h3>
                  <p className="metadata">
                    {commit.author} · {dateText(commit.date)}
                  </p>
                  <div className="ref-list">
                    {refs
                      .filter((r) => r.hash === hash)
                      .map((r) => (
                        <span className="ref-pill" key={r.kind + r.name}>
                          {r.kind === 'tag' ? (
                            <Tag size={13} />
                          ) : (
                            <GitBranch size={13} />
                          )}{' '}
                          {r.name}
                        </span>
                      ))}
                  </div>
                  <div className="micro-label">Parents</div>
                  <div className="ref-list">
                    {commit.parents.map((p) => (
                      <button
                        className="hash-pill"
                        key={p}
                        onClick={() => select(p)}
                      >
                        {short(p)}
                      </button>
                    ))}
                    {!commit.parents.length && <span>Root commit</span>}
                  </div>
                  <Source url={commit.url}>Open commit</Source>
                </>
              ) : (
                <p>
                  This commit is outside the loaded records. Load more commits
                  to look for its source record.
                </p>
              )}
            </article>
          </div>
          {graphError && <Problem text={graphError} />}
          <div className="subheading">
            <h3>Commit list</h3>
          </div>
          <div className="record-list">
            {commits.map((c) => (
              <button
                className={'record-row ' + (c.hash === hash ? 'selected' : '')}
                aria-pressed={c.hash === hash}
                key={c.hash}
                onClick={() => select(c.hash)}
              >
                <GitCommitHorizontal size={16} />
                <span>
                  <strong>{c.message.split('\n')[0]}</strong>
                  <small>
                    {c.author} · {dateText(c.date)}
                  </small>
                </span>
                <code>{short(c.hash)}</code>
              </button>
            ))}
          </div>
        </>
      )}
      <More
        hasNext={page.data?.next}
        busy={page.busy}
        action={page.next}
        label="Load more commits"
      />
    </section>
  )
}
