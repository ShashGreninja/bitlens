import { useEffect, useRef, type ReactNode } from 'react'
import { FolderTree, GitCompareArrows, GitMerge, History, House, Network, Rewind } from 'lucide-react'
import type { Results } from '../../shared/types'
import { RepositorySwitcher } from './RepositorySwitcher'
import { HelpChat } from './HelpChat'
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
const viewIcons = { home: House, graph: Network, compare: GitCompareArrows, history: History, tree: FolderTree, replay: Rewind }

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
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const arrival = content.current?.animate(
        [{ opacity: 0.55 }, { opacity: 1 }],
        { duration: 170, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
      )
      return () => arrival?.cancel()
    }
  }, [view])
  return (
    <div className="repo-desk">
      <header className="desk-header">
        <button className="desk-brand" type="button" onClick={() => navigate('home')} aria-label="bitlens home">
          <GitMerge aria-hidden="true" size={20} />
          <strong>bitlens</strong>
        </button>
        <nav className="desk-nav" aria-label="Repository views">
        {deskViews.map(([key, name]) => {
          const Icon = viewIcons[key]
          return (
          <button
            type="button"
            key={key}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => navigate(key)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{name}</span>
          </button>
          )
        })}
        </nav>
        <div className="desk-actions">
          <RepositorySwitcher repo={repo} />
          <HelpChat view={view} />
        </div>
      </header>
      <main ref={content} className="desk-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
