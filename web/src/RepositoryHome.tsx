import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, GitCommitHorizontal, GitCompareArrows, GitMerge, Network } from 'lucide-react'
import type { Commit, Results } from '../../shared/types'
import { GraphRevisionPicker, graphRevisionHash } from './GraphRevisionPicker'
import { fixtureMode, isExample, service } from './service'
import { previewUrl } from './repositoryLocation'
import './home.css'

export function RepositoryHome({ repo, revision, canCompare, onCompare, onOpenGraph, onOpenCommit }: {
  repo: Results['bootstrap']
  revision: string
  canCompare: boolean
  onCompare: () => void
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
      if (isExample && !fixtureMode) {
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
  const example = previewUrl()
  example.search = '?fixture=1&walkthrough=release'
  return (
    <section className="desk-home">
      <div className="home-start">
        <div className="home-launch">
          <h1>Trace what changed.<br />Visually.</h1>
          <p>Follow Bitbucket commits, compare changes, and retrace branch moves.</p>
          <div className="home-actions">
            <form onSubmit={(event) => { event.preventDefault(); if (start) onOpenGraph(start) }}>
              <GraphRevisionPicker refs={repo.refs} revision={start} onChange={setStart} label="Branch or tag" />
              <button className="home-primary" type="submit" disabled={!start}>
                <Network size={19} aria-hidden="true" /> Open graph <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>
            <div className="home-other-actions">
              <button className="home-secondary" type="button" onClick={onCompare} disabled={!canCompare}>
                <GitCompareArrows size={17} aria-hidden="true" /> Compare revisions
              </button>
              {isExample && !fixtureMode && (
                <a className="home-example" href={example.href}>Try the release example</a>
              )}
            </div>
          </div>
        </div>
      </div>
      <section className="home-proof" aria-labelledby="recent-commits">
        <div className="home-proof-label">
          <h2 id="recent-commits">Recent commits</h2>
          {isExample && <span>{fixtureMode ? 'Local Git fixture' : 'Public Bitbucket preview'}</span>}
        </div>
        <div className="home-commit-list dock-single-pane">
          {commits?.map((commit) => {
            const Icon = commit.parents.length > 1 ? GitMerge : GitCommitHorizontal
            return (
              <button key={commit.hash} type="button" onClick={() => onOpenCommit(tip, commit.hash)}>
                <Icon size={21} aria-hidden="true" />
                <code>{commit.hash.slice(0, 7)}</code>
                <span className="home-commit-copy">
                  <strong>{commit.message.split('\n')[0]}</strong>
                  {!!commit.parents.length && <small>
                    {commit.parents.length === 1 ? 'Parent' : 'Parents'} {commit.parents.map((parent) => parent.slice(0, 7)).join(' · ')}
                  </small>}
                </span>
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
