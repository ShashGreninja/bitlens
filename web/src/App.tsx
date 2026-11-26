import { lazy, Suspense, useEffect, useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  ChevronsUpDown,
  CircleDot,
  Columns2,
  FolderGit2,
  GitBranch,
  GitCompareArrows,
  History,
  Link2,
  Network,
  RotateCcw,
  Share2,
  Tag,
} from 'lucide-react'
import type { Ref, Results } from '../../shared/types'
import {
  fixtureMode,
  isExample,
  readInvestigation,
  service,
  shareInvestigation,
  type Selection,
} from './service'
import {
  CopyButton,
  Dialog,
  Empty,
  Loading,
  Problem,
  Source,
} from './components/Common'
import { Compare } from './components/Compare'
import { FileHistory, Replay, Tree, replayKindName } from './components/Evidence'
import { Revisions } from './components/Revisions'
import {
  messageOf,
  pathOf,
  short,
  usePages,
  useLocateRecord,
} from './components/data'
import './app.css'
import { RepositoryHome } from './RepositoryHome'
import { RepositoryDesk, deskViews, type DeskView } from './RepositoryDesk'
import { graphRevision } from './GraphRevisionPicker'

const Atlas = lazy(() => import('./Atlas'))
const Graph = lazy(() => import('./components/Graph'))
const replayExample =
  fixtureMode &&
  new URLSearchParams(window.location.search).get('walkthrough') === 'replay'
const releaseExample =
  fixtureMode &&
  new URLSearchParams(window.location.search).get('walkthrough') === 'release'
const customPreview =
  isExample && new URLSearchParams(window.location.search).has('repo')
const views = {
  compare: {
    name: 'Compare',
    title: 'Compare revisions',
    description: 'Choose two versions, then select a file to see what changed.',
    icon: GitCompareArrows,
  },
  history: {
    name: 'File history',
    title: 'File history',
    description:
      'Enter a file path to see the commits that changed it, including renames.',
    icon: History,
  },
  graph: {
    name: 'Graph',
    title: 'Commit graph',
    description:
      'Trace commit ancestry through parent relationships, branches, and tags.',
    icon: Network,
  },
  replay: {
    name: 'Replay',
    title: 'Replay branch changes',
    description: 'See where a branch or tag pointed before and after a push, force-push, or deletion.',
    icon: RotateCcw,
  },
}
type View = keyof typeof views
const viewKeys = Object.keys(views) as View[]
const asView = (v?: string): View | 'tree' =>
  v === 'tree' ? v : viewKeys.includes(v as View) ? (v as View) : 'compare'
type Bootstrap = Results['bootstrap']
function markdownCode(value: string) {
  const line = value.replace(/[\r\n]+/g, ' ')
  const ticks = Math.max(0, ...(line.match(/`+/g) || []).map((run) => run.length))
  const fence = '`'.repeat(ticks + 1)
  return ticks ? fence + ' ' + line + ' ' + fence : fence + line + fence
}

function defaults(repo: Bootstrap) {
  const tags = repo.refs
    .filter((r) => r.kind === 'tag')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const branch = repo.refs.find(
    (r) => r.kind === 'branch' && r.name === repo.defaultBranch,
  )
  const target =
    fixtureMode && tags.some((r) => r.name === 'v1.5')
      ? 'v1.5'
      : tags.at(-1)?.name || branch?.name || repo.refs[0]?.name || ''
  const base =
    fixtureMode && tags.some((r) => r.name === 'v1.4')
      ? 'v1.4'
      : tags.at(-2)?.name || branch?.name || target
  return { base, target }
}
function Workspace({
  repo,
  initial,
  returnToMap,
  onView,
  embedded = false,
}: {
  repo: Bootstrap
  initial: Selection | null
  returnToMap?: (selection: Selection) => void
  onView?: (view: DeskView) => void
  embedded?: boolean
}) {
  const [selection, setSelection] = useState<Selection>(
    initial || defaults(repo),
  )
  const current = asView(embedded ? initial?.view : selection.view)
  const [dialog, setDialog] = useState<'share' | 'tree' | 'repo' | null>(null)
  const [share, setShare] = useState('')
  const [shareError, setShareError] = useState('')
  const [shareAttempt, setShareAttempt] = useState(0)
  const [refsExpanded, setRefsExpanded] = useState(false)
  const changeSelection = (p: Partial<Selection>) => {
    setSelection((s) => ({ ...s, ...p }))
    if (embedded && p.view) onView?.(p.view as DeskView)
  }
  const navigate = (view: View) =>
    view === 'graph' && returnToMap
      ? returnToMap({
          ...selection,
          target: fixed?.target || initial?.target || selection.target,
          view,
        })
      : changeSelection({ view })
  const compare = usePages(
    'compare',
    { base: selection.base, target: selection.target },
    !!(selection.base && selection.target) &&
      ((current !== 'replay' && !(embedded && current === 'graph')) ||
        dialog === 'share'),
  )
  const fixed = compare.data
  const change =
    fixed?.changes.find((c) => pathOf(c) === selection.path) ||
    (!selection.path
      ? fixed?.changes.find((c) => c.status === 'renamed') || fixed?.changes[0]
      : undefined)
  const path = selection.path || (change && pathOf(change)) || ''
  const restoringFile =
    initial &&
    initial.path === path &&
    fixed?.base === initial.base &&
    fixed?.target === initial.target
  const previousPath =
    change?.oldPath || (restoringFile ? initial.previousPath : undefined)
  const deleted = change
    ? ['removed', 'deleted'].includes(change.status)
    : Boolean(restoringFile && initial.fileSide === 'base')
  useLocateRecord(
    compare,
    initial?.path === path &&
      !change &&
      (current === 'compare' || current === 'history')
      ? path
      : undefined,
  )
  const detail = usePages(
    'detail',
    {
      base: fixed?.base,
      target: fixed?.target,
      path,
      oldPath: previousPath || undefined,
      deleted,
    },
    !!fixed &&
      !!path &&
      (current === 'compare' || current === 'history' || dialog === 'share'),
  )
  const graph = usePages(
    'graph',
    { base: fixed?.base, target: fixed?.target },
    !!fixed && current === 'graph' && !embedded,
  )
  const replay = usePages(
    'replay',
    {},
    current === 'replay' || (dialog === 'share' && Boolean(selection.event)),
  )
  const activeCommit =
    selection.commit || (current === 'graph' ? fixed?.target : undefined)
  const activeEvent =
    selection.event ||
    (current === 'replay'
      ? [...(replay.data?.events || [])]
          .sort(
            (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
          )
          .at(-1)?.id
      : undefined)
  const recordedEvent = replay.data?.events.find((event) => event.id === activeEvent)
  useLocateRecord(
    replay,
    dialog === 'share' && current !== 'replay' && !recordedEvent
      ? activeEvent
      : undefined,
  )
  const selectPair = (base: string, target: string) =>
    setSelection((s) => ({ base, target, view: s.view }))
  const sharedSelection = fixed
    ? JSON.stringify({
        base: fixed.base,
        target: fixed.target,
        path: path || undefined,
        previousPath: previousPath !== path ? previousPath : undefined,
        fileSide: deleted ? 'base' : undefined,
        commit: activeCommit,
        event: activeEvent,
        view: current,
      })
    : ''
  useEffect(() => {
    if (dialog !== 'share' || !sharedSelection) return
    let alive = true
    setShare('')
    setShareError('')
    shareInvestigation(JSON.parse(sharedSelection)).then(
      (url) => {
        if (alive) setShare(url)
      },
      (err) => {
        if (alive) setShareError(messageOf(err))
      },
    )
    return () => {
      alive = false
    }
  }, [dialog, sharedSelection, shareAttempt])
  const { title, description, name } =
    current === 'tree'
      ? {
          title: 'Source tree',
          description: 'Pick Baseline or Target to browse the files at that version.',
          name: 'Source',
        }
      : views[current]
  const Container = embedded ? 'section' : 'main'
  const evidence =
    detail.data?.history.find((c) => c.hash === activeCommit) ||
    (!activeCommit ? detail.data?.history[0] : undefined)
  const absolute = (url: string) => new URL(url, window.location.href).href
  const summaryBusy = detail.busy || replay.busy
  const eventSummary = recordedEvent
    ? [
        replayKindName(recordedEvent.kind) + ' ' + recordedEvent.refType + ' ' + markdownCode(recordedEvent.ref),
        'Recorded at: ' + markdownCode(recordedEvent.date),
        'Recorded by: ' + markdownCode(recordedEvent.actor || 'Unavailable'),
        'Before: ' + (recordedEvent.before ? markdownCode(recordedEvent.before) : 'No pointer recorded'),
        'After: ' + (recordedEvent.after ? markdownCode(recordedEvent.after) : 'No pointer recorded'),
        ...(recordedEvent.gap ? ['Replay coverage has a gap at this event.'] : []),
      ]
    : activeEvent
      ? ['Replay details are unavailable for this event.']
      : []
  const markdown =
    fixed && share && !summaryBusy
      ? [
          '## Repository investigation',
          '',
          'Repository: ' + repo.workspace + ' / ' + repo.repo,
          'Baseline: `' + fixed.base + '`',
          'Target: `' + fixed.target + '`',
          ...(path ? ['File: ' + markdownCode(path)] : []),
          ...(previousPath && previousPath !== path
            ? ['Previous path: ' + markdownCode(previousPath)]
            : []),
          ...(activeCommit ? ['Selected commit: `' + activeCommit + '`'] : []),
          ...(activeEvent ? ['Recorded event: `' + activeEvent + '`'] : []),
          ...eventSummary,
          '',
          ...(evidence
            ? [
                '[Commit ' +
                  short(evidence.hash) +
                  '](' +
                  absolute(evidence.url) +
                  ')',
                ...(evidence.pr
                  ? [
                      '[Pull request #' +
                        evidence.pr.id +
                        '](' +
                        absolute(evidence.pr.url) +
                        ')',
                    ]
                  : []),
              ]
            : []),
          '[Open investigation](' + share + ')',
        ].join('  \n')
      : ''
  function refButton(ref: Ref) {
    return (
      <button
        className="side-ref"
        title={'Set target to ' + ref.name}
        key={ref.kind + ref.name}
        onClick={() => selectPair(selection.base || ref.name, ref.name)}
      >
        {ref.kind === 'tag' ? <Tag size={14} /> : <GitBranch size={14} />}
        <span>{ref.name}</span>
      </button>
    )
  }
  return (
    <div className={embedded ? 'desk-workspace' : 'app-shell'}>
      {!embedded && (
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">
              <GitBranch size={22} strokeWidth={2.4} />
            </span>
            <span>bitlens</span>
          </div>
          <div className="sidebar-inner">
            <div className="sidebar-label">Workspace</div>
            <button
              className="workspace-switch"
              onClick={() => setDialog('repo')}
            >
              <span className="workspace-avatar">
                {repo.workspace.substring(0, 1).toUpperCase()}
              </span>
              <span>{repo.workspace}</span>
              <ChevronsUpDown size={13} />
            </button>
            <div className="sidebar-label nav-label">Investigation</div>
            <nav aria-label="Investigation views">
              {viewKeys.map((id) => {
                const Icon = views[id].icon
                return (
                  <button
                    key={id}
                    className={'nav-item ' + (id === current ? 'active' : '')}
                    aria-current={id === current ? 'page' : undefined}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={18} />
                    <span>{views[id].name}</span>
                    {id === current && <span className="nav-dot" />}
                  </button>
                )
              })}
            </nav>
            <div className="side-refs">
              <div className="sidebar-label">Repository refs</div>
              <button
                className="all-refs"
                onClick={() => setRefsExpanded(!refsExpanded)}
                aria-expanded={refsExpanded}
              >
                <ChevronRight
                  className={refsExpanded ? 'rotate' : ''}
                  size={13}
                />
                {refsExpanded ? 'Hide all refs' : 'All branches & tags'}
              </button>
              {refsExpanded && (
                <div className="expanded-refs">
                  {repo.refs.map(refButton)}
                  {!repo.refs.length && <small>No refs recorded.</small>}
                  {repo.partial && current !== 'replay' && (
                    <small>Only the first refs were returned.</small>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="sidebar-bottom">
            <span className="indicator" />
            <span>{fixtureMode ? 'Test fixture' : 'Bitbucket Cloud'}</span>
          </div>
        </aside>
      )}
      <Container className="main-panel">
        {!embedded && (
          <header className="topbar">
            <div className="crumb">
              <FolderGit2 size={16} />
              <button onClick={() => setDialog('repo')} className="crumb-repo">
                {repo.repo}
              </button>
              <ChevronRight size={13} />
              <span>{name}</span>
            </div>
            <span className="top-context">
              <CircleDot size={13} />
              {fixtureMode ? 'Test fixture' : 'Repository workspace'}
            </span>
          </header>
        )}
        <div className="main-content">
          <section className={embedded ? 'hero desk-page-heading' : 'hero'}>
            <div className="hero-copy">
              <h1>{title}</h1>
              {!embedded && <p>
                {fixtureMode &&
                current === 'compare' &&
                selection.base === 'v1.4' &&
                selection.target === 'v1.5'
                  ? 'Investigate the payment timeout. Select config.yml to see what changed between releases.'
                  : description}
              </p>}
            </div>
            {embedded && (
              <button
                className="button"
                disabled={current === 'replay' ? !selection.base || !selection.target : !fixed}
                onClick={() => setDialog('share')}
              >
                <Share2 size={15} /> Share investigation
              </button>
            )}
          </section>
          {!embedded && current === 'replay' && (
            <div className="replay-share">
              <button
                className="button"
                disabled={!selection.base || !selection.target}
                onClick={() => setDialog('share')}
              >
                <Share2 size={15} />
                Share investigation
              </button>
            </div>
          )}
          {!embedded && current !== 'replay' && (
            <div className="section-heading revisions-heading">
              <div className="heading-with-meta">
                <Columns2 size={17} />
                <h2>Revision range</h2>
              </div>
              <button
                className="button primary"
                disabled={!fixed}
                onClick={() => setDialog('share')}
              >
                <Share2 size={15} />
                Share investigation
              </button>
            </div>
          )}
          {current !== 'replay' && (
            <Revisions
              refs={repo.refs}
              base={selection.base}
              target={selection.target}
              hashes={fixed}
              setPair={selectPair}
              partial={repo.partial}
            />
          )}
          {!embedded && current !== 'replay' && repo.partial && (
            <div className="notice">
              Some repository refs are outside the loaded list. Enter a ref or
              commit hash to select it.
            </div>
          )}
          {current !== 'replay' && (!selection.base || !selection.target) && (
            <Empty
              title="Choose two revisions"
              text="Enter a branch, tag, or commit hash to begin an investigation."
            />
          )}
          {current !== 'compare' && compare.error && (
            <Problem text={compare.error} retry={compare.retry} />
          )}
          {current !== 'replay' &&
            current !== 'compare' &&
            compare.busy &&
            !fixed && <Loading text="Resolving revisions…" />}
          {current === 'compare' && selection.base && selection.target && (
            <Compare
              comparison={compare}
              detail={detail}
              path={path}
              select={(path) => changeSelection({ path, commit: undefined })}
              history={() => changeSelection({ path, view: 'history' })}
              tree={() => (embedded ? onView?.('tree') : setDialog('tree'))}
            />
          )}
          {current === 'history' && fixed && (
            <FileHistory
              path={path}
              changes={fixed.changes}
              detail={detail}
              selectPath={(path) =>
                changeSelection({ path, commit: undefined })
              }
              selected={selection.commit}
              selectCommit={(commit) => changeSelection({ commit })}
              graph={(commit) =>
                returnToMap
                  ? returnToMap({
                      base: fixed.base,
                      target: fixed.target,
                      commit,
                      view: 'graph',
                    })
                  : changeSelection({ commit, view: 'graph' })
              }
            />
          )}
          {current === 'graph' && fixed && (
            <Suspense fallback={<Loading text="Loading commit graph…" />}>
              <Graph
                page={graph}
                base={fixed.base}
                target={fixed.target}
                refs={repo.refs}
                selected={activeCommit}
                select={(commit) => changeSelection({ commit })}
              />
            </Suspense>
          )}
          {current === 'tree' && fixed && (
            <section className="workspace-section">
              <Tree
                key={fixed.base + fixed.target}
                base={fixed.base}
                target={fixed.target}
                initialPath=""
                trace={(path, hash) =>
                  changeSelection({
                    path,
                    target: hash,
                    view: 'history',
                    commit: undefined,
                  })
                }
              />
            </section>
          )}
          {current === 'replay' && (
            <Replay
              page={replay}
              selected={activeEvent}
              select={(event) => changeSelection({ event })}
              compare={(base, target, event) =>
                changeSelection({
                  base,
                  target,
                  event,
                  view: 'compare',
                  path: undefined,
                  previousPath: undefined,
                  fileSide: undefined,
                  commit: undefined,
                })
              }
            />
          )}
        </div>
      </Container>
      {dialog === 'share' && (
        <Dialog title="Share investigation" close={() => setDialog(null)}>
          <p className="dialog-description">
            Reopen these exact revisions and selected records with a link.
          </p>
          {shareError && (
            <Problem
              text={shareError}
              retry={() => setShareAttempt((x) => x + 1)}
            />
          )}
          {!shareError &&
            !share &&
            (compare.error ? (
              <Problem text={compare.error} retry={compare.retry} />
            ) : (
              <Loading text="Preparing link…" />
            ))}
          {share && (
            <>
              <label className="field-label" htmlFor="investigation-url">
                <Link2 size={14} />
                Investigation link
              </label>
              <input
                id="investigation-url"
                className="share-url"
                readOnly
                value={share}
                onFocus={(e) => e.target.select()}
              />
              <CopyButton label="Copy link" value={share} />
              {summaryBusy ? (
                <Loading text="Loading summary evidence…" />
              ) : (
                <>
                  <label className="field-label" htmlFor="markdown">
                    <BookOpen size={14} />
                    Markdown summary
                  </label>
                  <textarea id="markdown" readOnly value={markdown} rows={6} />
                  <CopyButton label="Copy Markdown" value={markdown} />
                </>
              )}
            </>
          )}
        </Dialog>
      )}
      {dialog === 'tree' && fixed && (
        <Dialog title="Source tree" close={() => setDialog(null)}>
          <Tree
            base={fixed.base}
            target={fixed.target}
            initialPath=""
            trace={(path, hash) => {
              changeSelection({
                path,
                target: hash,
                view: 'history',
                commit: undefined,
              })
              setDialog(null)
            }}
          />
        </Dialog>
      )}
      {dialog === 'repo' && (
        <Dialog title={repo.repo} close={() => setDialog(null)}>
          <dl className="facts">
            <dt>Workspace</dt>
            <dd>{repo.workspace}</dd>
            <dt>Default branch</dt>
            <dd>{repo.defaultBranch || 'Unknown'}</dd>
            <dt>Data source</dt>
            <dd>{fixtureMode ? 'Local Git fixture' : 'Bitbucket Cloud'}</dd>
          </dl>
          <Source url={repo.webUrl}>Open repository</Source>
        </Dialog>
      )}
    </div>
  )
}
export default function App() {
  const [repo, setRepo] = useState<Bootstrap>()
  const [initial, setInitial] = useState<Selection | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setError('')
    Promise.all([service('bootstrap'), readInvestigation()]).then(
      ([data, s]) => {
        if (alive) {
          setInitial(
            s ?? (replayExample ? { ...defaults(data), view: 'replay' } : null),
          )
          setRepo(data)
        }
      },
      (err) => {
        if (alive) setError(messageOf(err))
      },
    )
    return () => {
      alive = false
    }
  }, [attempt])
  if (!repo)
    return (
      <main className="repo-desk desk-workspace start-screen">
        <div className="brand-mark">
          <GitBranch size={24} />
        </div>
        <h1>bitlens</h1>
        {error ? (
          <>
            <Problem text={error} retry={() => setAttempt((v) => v + 1)} />
            {(window.location.search.includes('investigation=') || customPreview) && (
              <a
                className="source-link"
                href={
                  window.location.pathname + (fixtureMode ? '?fixture=1' : '')
                }
              >
                {customPreview ? 'Return to the sample repository' : 'Start a new investigation'}
              </a>
            )}
          </>
        ) : (
          <Loading text="Opening repository…" />
        )}
      </main>
    )
  return fixtureMode && !replayExample && !releaseExample ? (
    <Workspace repo={repo} initial={initial} />
  ) : (
    <LiveDesk repo={repo} initial={initial} />
  )
}

function LiveDesk({
  repo,
  initial,
}: {
  repo: Bootstrap
  initial: Selection | null
}) {
  const [view, setView] = useState<DeskView>(
    () =>
      deskViews.find(([key]) => key === initial?.view)?.[0] ||
      (initial ? 'graph' : 'home'),
  )
  const [evidenceView, setEvidenceView] = useState<DeskView>(
    view === 'home' || view === 'graph' ? 'compare' : view,
  )
  const [context, setContext] = useState<Selection>(
    () => initial || defaults(repo),
  )
  const [graph, setGraph] = useState({ initial, revision: 0 })
  const [startingRevision, setStartingRevision] = useState(() =>
    graphRevision(repo.refs, repo.defaultBranch, initial?.target),
  )
  const [investigation, setInvestigation] = useState(0)
  const [opened, setOpened] = useState(view !== 'graph' && view !== 'home')
  const [graphOpened, setGraphOpened] = useState(view === 'graph')
  function navigate(next: DeskView) {
    if (next === 'graph') setGraphOpened(true)
    else if (next !== 'home') {
      setOpened(true)
      setEvidenceView(next)
    }
    setView(next)
  }
  const openEvidence = (selection: Selection) => {
    setContext(selection)
    setInvestigation((value) => value + 1)
    navigate(selection.view as DeskView)
  }
  const traceCommit = (selection: Selection) => {
    setGraph((old) => ({ initial: selection, revision: old.revision + 1 }))
    setStartingRevision(
      graphRevision(repo.refs, repo.defaultBranch, selection.target),
    )
    navigate('graph')
  }
  return (
    <RepositoryDesk repo={repo} view={view} navigate={navigate}>
      {view === 'home' && (
        <RepositoryHome
          repo={repo}
          revision={startingRevision}
          canCompare={Boolean(context.base && context.target)}
          onCompare={() => navigate('compare')}
          onOpenGraph={(revision) => {
            setStartingRevision(revision)
            navigate('graph')
          }}
          onOpenCommit={(tip, commit) =>
            traceCommit({ base: tip, target: tip, commit, view: 'graph' })
          }
        />
      )}
      {graphOpened && (
        <div hidden={view !== 'graph'}>
          <Suspense fallback={<Loading text="Opening commit graph…" />}>
            <Atlas
              key={graph.revision}
              repo={repo}
              initial={graph.initial}
              revision={startingRevision}
              onRevisionChange={setStartingRevision}
              investigate={openEvidence}
            />
          </Suspense>
        </div>
      )}
      {opened && (
        <div hidden={view === 'graph' || view === 'home'}>
          <Workspace
            key={investigation}
            repo={repo}
            initial={{ ...context, view: evidenceView }}
            embedded
            onView={navigate}
            returnToMap={traceCommit}
          />
        </div>
      )}
    </RepositoryDesk>
  )
}
