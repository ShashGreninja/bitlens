import type { ReactNode } from 'react'
import { GitMerge } from 'lucide-react'
import type { Results } from '../../shared/types'
import { Source } from './components/Common'
import './desk.css'

export const deskViews = [
  ['home', 'Home'],
  ['graph', 'Graph'],
  ['compare', 'Compare'],
  ['history', 'File history'],
  ['tree', 'Source'],
  ['replay', 'Replay'],
] as const
export type DeskView = (typeof deskViews)[number][0]

export function RepositoryDesk({
  repo,
  view,
  navigate,
  children,
}: {
  repo: Results['bootstrap']
  view: DeskView
  navigate: (view: DeskView) => void
  children: ReactNode
}) {
  return (
    <div className="repo-desk">
      <header className="desk-header">
        <div className="desk-brand">
          <GitMerge aria-hidden="true" size={20} />
          <strong>Repository History</strong>
        </div>
        <Source url={repo.webUrl} className="desk-source">
          {repo.workspace} / {repo.repo}
        </Source>
      </header>
      <nav className="desk-nav" aria-label="Repository views">
        {deskViews.map(([key, name]) => (
          <button
            type="button"
            key={key}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => navigate(key)}
          >
            {name}
          </button>
        ))}
      </nav>
      <main className="desk-content">{children}</main>
    </div>
  )
}
