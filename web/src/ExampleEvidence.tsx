import { useSyncExternalStore, type ReactNode } from 'react'
import { evidenceUrl, exampleData } from './example'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function commitLink(hash: string) {
  return (
    <a href={evidenceUrl('commit', hash)}>
      <code>{hash.slice(0, 10)}</code>
    </a>
  )
}

function sourceTree(hash: string, path: string) {
  const files = exampleData.trees[hash]
  if (Object.hasOwn(files, path)) return <pre>{files[path]}</pre>
  const paths = Object.keys(files).filter(
    (file) => !path || file.startsWith(path + '/'),
  )
  if (!paths.length) return <p>This path is unavailable at this revision.</p>
  return (
    <ul>
      {paths.map((file) => (
        <li key={file}>
          <a href={evidenceUrl('source', hash, file)}>{file}</a>
        </li>
      ))}
    </ul>
  )
}

export function ExampleEvidence() {
  const fragment = useSyncExternalStore(subscribe, () => window.location.hash)
  const params = new URLSearchParams(fragment.slice(1))
  const kind = params.get('evidence')
  const hash = params.get('hash') ?? ''
  const path = params.get('path') ?? ''
  const commit = Object.hasOwn(exampleData.commits, hash)
    ? exampleData.commits[hash]
    : undefined
  const pr = commit && exampleData.prs[hash]
  let title = 'Evidence unavailable'
  let body: ReactNode = <p>This record does not exist in the example.</p>
  if (kind === 'repository') {
    title = 'payments-service'
    body = (
      <>
        <p>Local Git example for exploring release history.</p>
        <h2>Branches and tags</h2>
        <ul>
          {exampleData.refs.map((ref) => (
            <li key={ref.kind + ref.name}>
              {ref.name} · {commitLink(ref.hash)}
            </li>
          ))}
        </ul>
      </>
    )
  } else if (commit && kind === 'source') {
    title = path || 'Source tree'
    body = (
      <>
        <p>Revision {commitLink(hash)}</p>
        {sourceTree(hash, path)}
      </>
    )
  } else if (commit && kind === 'commit') {
    title = commit.message
    body = (
      <>
        <p>
          {commit.author} ·{' '}
          <time dateTime={commit.date}>
            {new Date(commit.date).toUTCString()}
          </time>
        </p>
        <dl>
          <dt>Commit</dt>
          <dd>
            <code>{hash}</code>
          </dd>
          <dt>Parents</dt>
          <dd>
            {commit.parents.length
              ? commit.parents.map((parent) => (
                  <span key={parent}>{commitLink(parent)} </span>
                ))
              : 'Initial commit'}
          </dd>
        </dl>
        {pr && (
          <p>
            <a href={evidenceUrl('pr', hash)}>
              #{pr.id} · {pr.title}
            </a>
          </p>
        )}
        <h2>Source at this revision</h2>
        {sourceTree(hash, '')}
      </>
    )
  } else if (commit && pr && kind === 'pr') {
    title = `#${pr.id} · ${pr.title}`
    body = (
      <>
        <p>
          This illustrative pull request links two commits from the local
          fixture. The judge guide walks through creating the corresponding
          Bitbucket pull request.
        </p>
        <dl>
          <dt>Merge strategy</dt>
          <dd>{pr.strategy}</dd>
          <dt>Source tip</dt>
          <dd>{commitLink(pr.source)}</dd>
          <dt>Landing commit</dt>
          <dd>{commitLink(hash)}</dd>
        </dl>
      </>
    )
  }
  function returnToApp() {
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
    window.location.reload()
  }
  return (
    <main className="example-evidence">
      <style>{`
      .example-evidence {box-sizing:border-box; max-width:850px; margin:48px auto; padding:0 28px 48px; font:16px/1.6 system-ui,sans-serif; color:#192b34;}
      .example-evidence header {display:flex; align-items:center; gap:1em; justify-content:space-between; border-bottom:1px solid #d4dfdc; padding-bottom:1em;}
      .example-evidence h1 {line-height:1.18; font-size:clamp(1.6rem,4vw,2.4rem); margin:1em 0 .4em; overflow-wrap:anywhere;}
      .example-evidence h2 {font-size:1.15rem; margin-top:1.65em;}
      .example-evidence a {color:#006650; text-decoration:underline;}
      .example-evidence button {background:#eef4f2; border:1px solid #c6d7cf; border-radius:5px; color:#124e3d; padding:8px 12px; cursor:pointer;}
      .example-evidence dd {margin:0 0 .75em; overflow-wrap:anywhere;}
      .example-evidence dt {color:#586762; font-size:.86rem;}
      .example-evidence pre {background:#f3f6f5; border:1px solid #d4dfdc; padding:16px; overflow-x:auto; font:14px/1.6 monospace;}
    `}</style>
      <header>
        <strong>Local example evidence</strong>
        <button onClick={returnToApp}>Return to investigation</button>
      </header>
      <h1>{title}</h1>
      {body}
    </main>
  )
}

export default ExampleEvidence
