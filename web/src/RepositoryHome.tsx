import { useState } from 'react'
import {
  ArrowRight,
  FileClock,
  FolderTree,
  GitBranch,
  GitCompareArrows,
  GitMerge,
  History,
} from 'lucide-react'
import type { Ref } from '../../shared/types'
import { GraphRevisionPicker } from './GraphRevisionPicker'
import type { DeskView } from './RepositoryDesk'
import './home.css'

const tools = [
  ['compare', GitCompareArrows, 'Compare revisions', 'See which files changed between two versions.'],
  ['history', FileClock, 'Follow a file', 'Find who changed a file, even if it was renamed.'],
  ['tree', FolderTree, 'Browse files', 'Open the source tree at an earlier revision.'],
  ['replay', History, 'Replay branch activity', 'See recorded updates to branches and tags.'],
] as const

export function RepositoryHome({
  refs,
  revision,
  onOpenGraph,
  navigate,
}: {
  refs: Ref[]
  revision: string
  onOpenGraph: (revision: string) => void
  navigate: (view: DeskView) => void
}) {
  const [start, setStart] = useState(revision)
  return (
    <section className="desk-home">
      <div className="home-start">
        <div className="home-launch">
          <h1>Explore your repository’s history</h1>
          <p>
            Start from a branch or tag. The graph shows how its commits connect
            and what each one changed.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (start) onOpenGraph(start)
            }}
          >
            <GraphRevisionPicker
              refs={refs}
              revision={start}
              onChange={setStart}
              label="Branch or tag"
            />
            <button className="home-primary" type="submit" disabled={!start}>
              Open graph <ArrowRight size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
        <section className="home-guide" aria-labelledby="home-steps">
          <h2 id="home-steps">How to use it</h2>
          <div className="home-ancestry" aria-hidden="true">
            <span className="home-commit home-commit-start">
              <GitBranch size={16} /> Branch tip
            </span>
            <span className="home-commit home-commit-merge">
              <GitMerge size={17} /> Merge
            </span>
            <span className="home-commit">Earlier commit</span>
            <span className="home-commit home-commit-side">Merged branch</span>
          </div>
          <ol className="home-instructions">
            <li>
              <strong>Open a commit</strong>
              <span>Click its title to see the author and open its diff.</span>
            </li>
            <li>
              <strong>Go back in time</strong>
              <span>Expand its parents to see the commits that came before it.</span>
            </li>
            <li>
              <strong>Compare two commits</strong>
              <span>Pin one as baseline and another as target.</span>
            </li>
          </ol>
        </section>
      </div>
      <section className="home-tools" aria-labelledby="home-tools-title">
        <h2 id="home-tools-title">Looking for something specific?</h2>
        <div className="home-tool-list">
          {tools.map(([view, Icon, title, description]) => (
            <button key={view} type="button" onClick={() => navigate(view)}>
              <Icon size={19} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </section>
  )
}
