import { useState, type FormEvent } from 'react'
import { ChevronDown, FolderGit2 } from 'lucide-react'
import type { Results } from '../../shared/types'
import { Dialog, Problem, Source } from './components/Common'
import { messageOf } from './components/data'
import { previewUrl, repositoryName } from './repositoryLocation'
import { isExample, openSource } from './service'

export function RepositorySwitcher({ repo }: { repo: Results['bootstrap'] }) {
  const active = `${repo.workspace}/${repo.repo}`
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const name = repositoryName(value)
      if (name === active.toLowerCase()) {
        setOpen(false)
        return
      }
      if (import.meta.env.MODE === 'example') {
        const { checkPublicRepository } = await import('./publicHistory')
        await checkPublicRepository(name)
        window.location.assign(previewUrl(name).href)
      } else {
        await openSource(`https://bitbucket.org/${name}`)
        setOpen(false)
      }
    } catch (error) {
      setError(messageOf(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="desk-workspace desk-repository">
      <button
        type="button"
        className="desk-switch"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setValue('')
          setError('')
          setOpen(true)
        }}
      >
        <FolderGit2 size={16} aria-hidden="true" />
        <span>
          <small>Change repository</small>
          <strong>{active}</strong>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <Dialog
          title="Open a repository"
          close={() => {
            if (!busy) setOpen(false)
          }}
        >
          <p id="repo-entry-hint" className="repo-entry-hint">
            {isExample
              ? 'Paste a public Bitbucket Cloud repository URL or enter workspace/repository. For private repositories, open Apps → bitlens from the repository in Bitbucket after installation.'
              : 'Open any repository you can access in Bitbucket. Choose Apps → bitlens there to see its history.'}
          </p>
          <form className="repo-entry" onSubmit={submit}>
            <label htmlFor="repository-location">Repository URL or name</label>
            <input
              id="repository-location"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="workspace/repository"
              aria-describedby="repo-entry-hint"
              autoFocus
              required
              disabled={busy}
            />
            {error && <Problem text={error} />}
            <button
              type="submit"
              className="button primary"
              disabled={busy || !value.trim()}
            >
              {busy ? 'Opening repository…' : isExample ? 'Open repository' : 'Open in Bitbucket'}
            </button>
          </form>
          <div className="repo-entry-links">
            <Source url={repo.webUrl}>View current repository</Source>
            {isExample && (
              <a className="source-link" href={previewUrl().href}>
                Use the sample repository
              </a>
            )}
          </div>
        </Dialog>
      )}
    </div>
  )
}
