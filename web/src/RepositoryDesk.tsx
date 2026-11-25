import { useEffect, useRef, type ReactNode } from 'react'
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
  const content = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  useEffect(() => {
    if (previousView.current === view) return
    previousView.current = view
    content.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [view])
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
      <main ref={content} className="desk-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
