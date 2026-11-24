import type { Params, Ref, Results, Revision } from '../shared/types'
import {
  change,
  commit,
  compareSpec,
  encodedPath,
  filePath,
  fullHash,
  isHash,
  revision,
  type ApiChange,
  type ApiCommit,
} from './gitRecords'
import type { RepositoryStorage } from './storage'

type Page<T> = { values: T[]; next?: string }
type BitbucketRef = {
  name: string
  type: Ref['kind']
  target: { hash: string }
}
type Entry = { path: string; type: string; commit: ApiCommit }
type PullRequest = {
  id: number
  title: string
  merge_commit?: { hash: string }
  state: string
}
export type Repository = {
  uuid: string
  slug: string
  full_name: string
  workspace: { uuid: string; slug: string }
  mainbranch?: { name: string } | null
}
type ResponseLike = {
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}
export type FetchRepo = (
  suffix: string,
  accept: string,
) => Promise<ResponseLike>
type Store = Pick<
  RepositoryStorage,
  'loadCursor' | 'saveCursor' | 'initialize' | 'replay'
>

export class BitbucketError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 401 || status === 403
        ? 'You do not have access to this Bitbucket resource.'
        : status === 404
          ? 'Bitbucket could not find this repository, revision or path, or you do not have access to it.'
          : status === 429
            ? 'Bitbucket rate-limited this request. Try again shortly.'
            : 'Bitbucket could not complete the request (HTTP ' + status + ').',
    )
  }
}

async function json<T>(request: Promise<ResponseLike>): Promise<T> {
  const result = await request
  if (!result.ok || result.status === 202)
    throw new BitbucketError(result.status)
  return (await result.json()) as T
}

export async function authorize(fetch: FetchRepo): Promise<Repository> {
  return json<Repository>(fetch('', 'application/json'))
}

// Continuations are written by the server and bound to the original query.
// Follow the upstream pagination parameters (including opaque Git iterators),
// while keeping the repository route fixed to the authorized UUIDs.
function continuation(href: string, repo: Repository, endpoint: string) {
  const u = new URL(href)
  const [, version, group, ws, slug, ...tail] = u.pathname.split('/')
  const names = repo.full_name.split('/')
  const matches = (s: string, choices: string[]) =>
    choices.some((c) => c.toLowerCase() === decodeURIComponent(s).toLowerCase())
  if (
    u.origin !== 'https://api.bitbucket.org' ||
    version !== '2.0' ||
    group !== 'repositories' ||
    !matches(ws, [repo.workspace.uuid, repo.workspace.slug, names[0]]) ||
    !matches(slug, [repo.uuid, repo.slug, names[1]]) ||
    tail[0] !== endpoint ||
    tail.some(
      (s) =>
        /^(\.|\.\.)$/.test(decodeURIComponent(s)) ||
        /[\\\x00-\x1f]/.test(decodeURIComponent(s)),
    )
  ) {
    throw new Error('Bitbucket returned an unexpected continuation.')
  }
  return '/' + tail.join('/') + u.search
}

export async function history(
  op: keyof Results,
  p: Params,
  repo: Repository,
  fetch: FetchRepo,
  storage: Store,
): Promise<Results[keyof Results]> {
  const webUrl = 'https://bitbucket.org/' + encodedPath(repo.full_name)
  const get = <T>(suffix: string) => json<T>(fetch(suffix, 'application/json'))
  const page = async <T>(suffix: string) => {
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify([op, suffix])),
    )
    const scope = Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
    const uri = p.cursor
      ? await storage.loadCursor<string>(scope, p.cursor)
      : suffix
    const data = await get<Page<T>>(uri)
    if (!Array.isArray(data.values))
      throw new Error('Bitbucket returned an unexpected page.')
    const endpoint = suffix.slice(1).split(/[/?]/)[0]
    const next = data.next
      ? await storage.saveCursor(scope, continuation(data.next, repo, endpoint))
      : undefined
    return { values: data.values, next }
  }
  const resolve = async (value: unknown) => {
    const name = revision(value)
    if (isHash(name)) return fullHash(name)
    return fullHash(
      (await get<ApiCommit>('/commit/' + encodeURIComponent(name))).hash,
    )
  }
  const listRefs = async () => {
    const groups = await Promise.all(
      ['branches', 'tags'].map((group) =>
        get<Page<BitbucketRef>>(
          '/refs/' +
            group +
            '?pagelen=100&sort=-target.date&fields=next,values.name,values.type,values.target.hash',
        ),
      ),
    )
    const refs = groups.flatMap((g) =>
      g.values.map((r) => ({
        kind: r.type,
        hash: fullHash(r.target.hash),
        name: r.name,
      })),
    )
    const main = repo.mainbranch?.name
    if (main && !refs.some((r) => r.kind === 'branch' && r.name === main)) {
      refs.unshift({ name: main, kind: 'branch', hash: await resolve(main) })
    }
    return { refs, partial: groups.some((g) => !!g.next) }
  }

  if (op === 'bootstrap') {
    const list = await listRefs()
    await storage.initialize(list)
    return {
      ...list,
      workspace: repo.workspace.slug,
      repo: repo.slug,
      defaultBranch: repo.mainbranch?.name ?? '',
      webUrl,
    }
  }
  if (op === 'replay') return storage.replay(p.cursor, listRefs)
  if (op === 'tree') {
    const hash = await resolve(p.target)
    const path = filePath(p.path, true)
    const entries = await page<Entry>(
      '/src/' +
        hash +
        '/' +
        (path ? encodedPath(path) + '/' : '') +
        '?pagelen=50&fields=next,values.type,values.path',
    )
    return {
      next: entries.next,
      entries: entries.values.map((e) => ({
        path: e.path,
        directory: e.type === 'commit_directory',
        url: webUrl + '/src/' + hash + '/' + encodedPath(e.path),
      })),
    }
  }

  const [base, target] = await Promise.all([resolve(p.base), resolve(p.target)])
  const spec = compareSpec(base, target)
  if (op === 'compare') {
    const stats = await page<ApiChange>(
      '/diffstat/' + spec + '?topic=false&renames=true&pagelen=50',
    )
    return { base, target, changes: stats.values.map(change), next: stats.next }
  }
  if (op === 'graph') {
    const query = new URLSearchParams({ include: target, pagelen: '40' })
    if (target !== base) query.append('include', base)
    const commits = await page<ApiCommit>('/commits?' + query)
    return {
      commits: commits.values.map((c) => commit(c, webUrl)),
      next: commits.next,
    }
  }
  if (op !== 'detail') throw new Error('Unknown repository history operation.')

  const path = filePath(p.path)
  const oldPath = p.oldPath ? filePath(p.oldPath) : path
  const sourcePath = p.deleted ? oldPath : path
  const sourceCommit = p.deleted ? base : target
  const warnings: string[] = []
  const historyUrl =
    '/filehistory/' +
    sourceCommit +
    '/' +
    encodedPath(sourcePath) +
    '?renames=true&pagelen=8&fields=next,values.path,values.commit.hash,values.commit.date,values.commit.message,values.commit.author.raw,values.commit.author.user.display_name'
  // Older pages carry only history. Keep the first page's diff in the client.
  const diffWork = async () => {
    if (p.cursor) return ''
    const query = new URLSearchParams({
      topic: 'false',
      renames: 'true',
      binary: 'false',
      path: sourcePath,
    })
    if (oldPath !== sourcePath) query.append('path', oldPath)
    const suffix = '/diff/' + spec + '?' + query
    const response = await fetch(suffix, 'text/plain')
    if (!response.ok) {
      warnings.push(
        'File diff is unavailable. ' +
          new BitbucketError(response.status).message,
      )
      return ''
    }
    const diff = await response.text()
    if (diff.length > 150000)
      warnings.push('Diff preview is truncated to 150,000 characters.')
    return diff.slice(0, 150000)
  }
  const [files, diff] = await Promise.all([
    page<Entry>(historyUrl).catch((e) => {
      if (!(e instanceof BitbucketError) || p.cursor) throw e
      warnings.push('File history is unavailable. ' + e.message)
      return { values: [] as Entry[], next: undefined }
    }),
    diffWork(),
  ])
  const revisions: Revision[] = files.values.map((entry) => {
    const c = commit(entry.commit, webUrl)
    return {
      hash: c.hash,
      date: c.date,
      message: c.message,
      author: c.author,
      url: c.url,
      path: entry.path,
    }
  })
  if (revisions.length) {
    const prFields =
      'next,values.id,values.title,values.state,values.merge_commit.hash'
    const filter = revisions
      .map((r) => 'merge_commit.hash = "' + r.hash + '"')
      .join(' OR ')
    const query = new URLSearchParams({
      state: 'MERGED',
      q: filter,
      pagelen: '50',
      fields: prFields,
    })
    const verified = new Map<string, Promise<string>>()
    const mergeHash = (pr: PullRequest) => {
      const hash = pr.merge_commit?.hash
      if (!hash || !/^[a-f0-9]{7,40}$/i.test(hash)) return Promise.resolve('')
      if (!verified.has(hash)) verified.set(hash, resolve(hash))
      return verified.get(hash)!
    }
    const evidence = (pr: PullRequest) => ({
      id: pr.id,
      title: pr.title,
      url: webUrl + '/pull-requests/' + pr.id,
    })
    try {
      const prs = await get<Page<PullRequest>>('/pullrequests?' + query)
      // Bitbucket can return a 12-character merge_commit even when its filter
      // matches a full SHA. Resolve that object before assigning the evidence.
      await Promise.all(
        prs.values
          .filter((pr) => pr.state === 'MERGED')
          .map(async (pr) => {
            const hash = await mergeHash(pr)
            const r = revisions.find((r) => r.hash === hash)
            if (r) r.pr = evidence(pr)
          }),
      )
      if (prs.next)
        warnings.push('More matching pull requests are available in Bitbucket.')
    } catch (e) {
      if (!(e instanceof BitbucketError)) throw e
      warnings.push('Merge commit evidence is unavailable. ' + e.message)
    }

    // Ordinary merges may leave the original reviewed commit in filehistory.
    // Confirm both the reviewed commit association and the merge's ancestry
    // before connecting that PR to the selected target.
    const pending = revisions.filter((r) => !r.pr)
    const landing = new Map<string, Promise<boolean>>()
    for (let i = 0; i < pending.length; i += 4) {
      await Promise.all(
        pending.slice(i, i + 4).map(async (r) => {
          try {
            const links = await get<Page<PullRequest>>(
              '/commit/' +
                r.hash +
                '/pullrequests?pagelen=10&fields=' +
                prFields,
            )
            for (const pr of links.values) {
              if (pr.state !== 'MERGED') continue
              const hash = await mergeHash(pr)
              if (!hash) continue
              if (!landing.has(hash))
                landing.set(
                  hash,
                  hash === target
                    ? Promise.resolve(true)
                    : get<ApiCommit>(
                        '/merge-base/' + hash + '..' + target + '?fields=hash',
                      ).then((c) => c.hash === hash),
                )
              if (await landing.get(hash)) {
                r.pr = evidence(pr)
                break
              }
            }
            if (links.next && !r.pr)
              warnings.push(
                'Additional reviewed pull requests are available in Bitbucket.',
              )
          } catch (e) {
            if (!(e instanceof BitbucketError)) throw e
            warnings.push('Some reviewed pull request links are unavailable.')
          }
        }),
      )
    }
  }
  return {
    diff,
    history: revisions,
    next: files.next,
    warning: [...new Set(warnings)].join(' ') || undefined,
  }
}
