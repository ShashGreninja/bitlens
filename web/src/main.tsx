import { Component, lazy, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" className="repo-desk desk-fallback">
        <h1>Repository History could not open this view</h1>
        <p>Reload to retry the investigation.</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </main>
    )
  }
}

const ExampleEvidence =
  import.meta.env.MODE === 'example'
    ? lazy(() => import('./ExampleEvidence'))
    : null
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    {ExampleEvidence && window.location.hash.startsWith('#evidence=') ? (
      <Suspense
        fallback={
          <main className="repo-desk desk-fallback" role="status">
            Loading source record…
          </main>
        }
      >
        <ExampleEvidence />
      </Suspense>
    ) : (
      <App />
    )}
  </ErrorBoundary>,
)
