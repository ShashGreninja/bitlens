import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, GitCommitHorizontal, GitMerge } from 'lucide-react'
import type { Commit, Results } from '../../shared/types'
import { GraphRevisionPicker, graphRevisionHash } from './GraphRevisionPicker'
import { isExample, service } from './service'
import './home.css'

export function RepositoryHome({ repo, revision, onOpenGraph, onOpenCommit }: {
  repo: Results['bootstrap']
  revision: string
  onOpenGraph: (revision: string) => void
  onOpenCommit: (tip: string, commit: string) => void
}) {
  const [start, setStart] = useState(revision)
  const [preview, setPreview] = useState<{ tip: string; commits: Commit[] }>()
  const tip = graphRevisionHash(repo.refs, start)

  useEffect(() => {
    if (!tip) return
    let active = true
    async function read() {
      if (import.meta.env.MODE === 'example') {
        const { archive, snapshotRepository } = await import('./publicHistory')
        const head = archive.get(tip)
        if (head && snapshotRepository === `${repo.workspace}/${repo.repo}`) {
          const records = new Map([[head.hash, head]])
          for (const commit of records.values()) {
            for (const parent of commit.parents) {
              const record = archive.get(parent)
              if (record && records.size < 5) records.set(parent, record)
            }
          }
          return [...records.values()]
        }
      }
      return (await service('graph', { base: tip, target: tip })).commits.slice(0, 5)
    }
    read().then(
      (commits) => { if (active) setPreview({ tip, commits }) },
      () => { if (active) setPreview({ tip, commits: [] }) },
    )
    return () => { active = false }
  }, [repo.repo, repo.workspace, tip])

  const commits = preview?.tip === tip ? preview.commits : undefined
  return (
    <section className="desk-home">
      <div className="home-start">
        <div className="home-launch">
          <h1>Trace what<br />changed.</h1>
          <p>Explore Bitbucket history from a branch tip to the line that changed.</p>
          <form onSubmit={(event) => { event.preventDefault(); if (start) onOpenGraph(start) }}>
            <GraphRevisionPicker refs={repo.refs} revision={start} onChange={setStart} label="Branch or tag" />
            <button className="home-primary" type="submit" disabled={!start}>
              Open graph <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
      <section className="home-proof" aria-labelledby="recent-commits">
        <div className="home-proof-label">
          <h2 id="recent-commits">Recent commits</h2>
          {isExample && <span>Public Bitbucket preview</span>}
        </div>
        <div className="home-commit-list">
          {commits?.map((commit) => {
            const Icon = commit.parents.length > 1 ? GitMerge : GitCommitHorizontal
            return (
              <button key={commit.hash} type="button" onClick={() => onOpenCommit(tip, commit.hash)}>
                <Icon size={21} aria-hidden="true" />
                <code>{commit.hash.slice(0, 7)}</code>
                <span>{commit.message.split('\n')[0]}</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            )
          })}
          {!commits?.length && <p role="status">{!tip ? 'This repository has no revisions yet.' : commits ? 'Preview unavailable. Open the graph to try again.' : 'Loading commits…'}</p>}
        </div>
      </section>
    </section>
  )
}
