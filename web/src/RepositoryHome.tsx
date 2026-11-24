import { ArrowRight, GitBranch } from 'lucide-react'
import type { DeskView } from './RepositoryDesk'

const steps = [
  [
    'graph',
    'Choose where to start',
    'Pick a branch or tag. Drag the background to pan, scroll to zoom, and expand a commit to follow its parents.',
  ],
  [
    'compare',
    'See what changed',
    'Pin a baseline and target in Graph, or choose two revisions in Compare. Open a changed file to see its diff.',
  ],
  [
    'history',
    'Follow a file',
    'Enter a path or open a file from Compare. File history follows the changes, including earlier names.',
  ],
] as const

export function RepositoryHome({
  navigate,
}: {
  navigate: (view: DeskView) => void
}) {
  return (
    <section className="desk-home">
      <header>
        <h1>Find what changed</h1>
        <p>
          Start with a branch, tag, or file. Follow it through your Bitbucket
          repository.
        </p>
        <button className="home-primary" onClick={() => navigate('graph')}>
          <GitBranch size={17} /> Open graph <ArrowRight size={17} />
        </button>
      </header>
      <section aria-labelledby="home-steps">
        <h2 id="home-steps">How to use it</h2>
        <ol>
          {steps.map(([view, title, description]) => (
            <li key={view}>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <button onClick={() => navigate(view)}>
                {view === 'history'
                  ? 'File history'
                  : view === 'compare'
                    ? 'Compare'
                    : 'Graph'}{' '}
                <ArrowRight size={16} />
              </button>
            </li>
          ))}
        </ol>
      </section>
      <div className="home-extra">
        <button onClick={() => navigate('tree')}>
          Source <ArrowRight size={16} />
        </button>
        <span>Browse files as they were at either revision.</span>
        <button onClick={() => navigate('replay')}>
          Replay <ArrowRight size={16} />
        </button>
        <span>
          Step through branch and tag events recorded after app installation.
        </span>
      </div>
    </section>
  )
}
