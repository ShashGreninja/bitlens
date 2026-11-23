import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareSpec,
  filePath,
  pushObservation,
  repositoryContext,
  trackEvent,
  type PushPayload,
} from '../src/domain'
import {
  authorize,
  history,
  type FetchRepo,
  type Repository,
} from '../src/history'
import type { Results } from '../shared/types'

const a = 'a'.repeat(40),
  b = 'b'.repeat(40),
  c = 'c'.repeat(40)
const id = '{f9b2b732-6a5b-4ea1-9ebf-fd1f67b65cab}'
const repo: Repository = {
  uuid: id,
  workspace: { uuid: id, slug: 'team' },
  slug: 'sample',
  full_name: 'team/sample',
  mainbranch: { name: 'main' },
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status })
const fakeStore = () => {
  const values = new Map<string, unknown>()
  return {
    saveCursor: async <T>(scope: string, data: T) => {
      values.set(scope, data)
      return 'opaque'
    },
    loadCursor: async <T>(scope: string, token: unknown) => {
      if (token !== 'opaque' || !values.has(scope))
        throw new Error('expired selection')
      return values.get(scope) as T
    },
    initialize: async () => {},
    replay: async () => ({ events: [], since: null }),
  }
}

test('compare resolves tags, uses immutable target..base and follows only same-repository continuations', async () => {
  const store = fakeStore()
  const endpoint = '/diffstat/' + b + '..' + a
  const fetch: FetchRepo = async (path) => {
    if (path === '/commit/v1.4') return json({ hash: a })
    if (path === '/commit/v1.5') return json({ hash: b })
    assert.ok(path.startsWith(endpoint))
    if (path.includes('page=opaque-2')) return json({ values: [] })
    assert.match(path, /topic=false/)
    return json({
      values: [
        {
          old: null,
          new: { path: 'new.txt' },
          lines_added: 3,
          lines_removed: 0,
          status: 'added',
        },
      ],
      next:
        'https://api.bitbucket.org/2.0/repositories/team/sample' +
        endpoint +
        '?topic=false&page=opaque-2',
    })
  }
  const params = { base: 'v1.4', target: 'v1.5' }
  const result = (await history(
    'compare',
    params,
    repo,
    fetch,
    store,
  )) as Results['compare']
  assert.deepEqual([result.base, result.target], [a, b])
  assert.deepEqual(result.changes[0], {
    oldPath: null,
    newPath: 'new.txt',
    added: 3,
    removed: 0,
    status: 'added',
  })
  const more = (await history(
    'compare',
    { ...params, cursor: result.next },
    repo,
    fetch,
    store,
  )) as Results['compare']
  assert.deepEqual(more.changes, [])
  await assert.rejects(
    history(
      'compare',
      { base: a, target: b },
      repo,
      async () =>
        json({
          values: [],
          next: 'https://api.bitbucket.org/2.0/repositories/team/other/diffstat/hash?page=2',
        }),
      store,
    ),
    /unexpected continuation/,
  )
  assert.equal(compareSpec(a, b), b + '..' + a)
})

test('follows renamed paths and links only a verified merge on the target', async () => {
  const routes: string[] = []
  const fetch: FetchRepo = async (path) => {
    routes.push(path)
    if (path.startsWith('/filehistory/'))
      return json({
        values: [
          {
            path: 'services/payments/config.yml',
            commit: { hash: b, message: 'Move settings' },
          },
          {
            path: 'payments/config.yml',
            commit: { hash: a, message: 'Change timeout' },
          },
        ],
      })
    if (path.startsWith('/diff/'))
      return new Response('@@ -1 +1 @@\n-timeout: 3\n+timeout: 5')
    if (path.startsWith('/pullrequests?'))
      return json({
        values: [
          {
            id: 45,
            title: 'Move config',
            state: 'MERGED',
            merge_commit: { hash: b.slice(0, 12) },
          },
        ],
      })
    if (path === '/commit/' + b.slice(0, 12)) return json({ hash: b })
    if (path.startsWith('/commit/' + a + '/pullrequests?'))
      return json({
        values: [
          {
            id: 80,
            title: 'Unrelated landing',
            state: 'MERGED',
            merge_commit: { hash: c },
          },
        ],
      })
    if (path.startsWith('/merge-base/')) return json({ hash: a })
    throw Error(path)
  }
  const r = (await history(
    'detail',
    {
      base: a,
      target: b,
      path: 'services/payments/config.yml',
      oldPath: 'payments/config.yml',
    },
    repo,
    fetch,
    fakeStore(),
  )) as Results['detail']
  assert.deepEqual(
    r.history.map((i) => [i.path, i.pr?.id]),
    [
      ['services/payments/config.yml', 45],
      ['payments/config.yml', undefined],
    ],
  )
  assert.ok(
    routes.some((p) =>
      p.startsWith(
        '/filehistory/' + b + '/services/payments/config.yml?renames=true',
      ),
    ),
  )
  assert.match(r.diff, /\+timeout: 5/)
  const diffRequest = new URL(
    routes.find((p) => p.startsWith('/diff/'))!,
    'https://api.bitbucket.org',
  )
  assert.deepEqual(diffRequest.searchParams.getAll('path'), [
    'services/payments/config.yml',
    'payments/config.yml',
  ])
})

test('deleted file history and its diff are read from the surviving old path', async () => {
  const observed: string[] = []
  await history(
    'detail',
    { base: a, target: b, path: 'old/file', deleted: true },
    repo,
    async (p) => {
      observed.push(p)
      return p.startsWith('/diff/')
        ? new Response('removed')
        : json({ values: [] })
    },
    fakeStore(),
  )
  assert.ok(
    observed.some((p) => p.startsWith('/filehistory/' + a + '/old/file?')),
  )
  assert.ok(observed.some((p) => p.includes('path=old%2Ffile')))
})

test('graph preserves first and second parents and does not create PR edges', async () => {
  const r = (await history(
    'graph',
    { base: a, target: b },
    repo,
    async (p) => {
      assert.deepEqual(
        new URL(p, 'https://example.invalid').searchParams.getAll('include'),
        [b, a],
      )
      return json({
        values: [{ hash: b, parents: [{ hash: a }, { hash: c }] }],
      })
    },
    fakeStore(),
  )) as Results['graph']
  assert.deepEqual(r.commits[0].parents, [a, c])
})

const push: PushPayload = {
  eventType: 'avi:bitbucket:push:repository',
  workspace: { uuid: id },
  repository: { uuid: id },
  timestamp: '2026-10-15T08:10:07.123000Z',
  actor: { accountId: 'pusher' },
  push: {
    ref: 'release',
    mainbranch: false,
    created: false,
    closed: false,
    forced: true,
    before: a,
    after: b,
  },
}
test('force pushes, archived pointers, retries, delayed deliveries and tag namespace', () => {
  const e = pushObservation(push)
  assert.deepEqual(e, pushObservation(push))
  assert.equal(e.kind, 'force-push')
  assert.equal(e.actor, 'pusher')
  assert.equal(e.before, a)
  assert.equal(e.after, b)
  const deleted = pushObservation({
    ...push,
    push: {
      ...push.push,
      forced: false,
      closed: true,
      before: b,
      after: undefined,
    },
    timestamp: '2026-10-16T00:00:00Z',
  })
  assert.equal(deleted.after, null)
  assert.equal(deleted.before, b)
  const state = new Map([['branch/release', a]])
  for (const evt of [deleted, e].sort((l, r) => l.date.localeCompare(r.date)))
    assert.equal(trackEvent(evt, state).gap, false)
  assert.equal(trackEvent(e, state).gap, true)
  const tag = pushObservation({
    ...push,
    push: {
      ref: 'release',
      created: true,
      forced: false,
      closed: false,
      after: b,
    },
  })
  assert.equal(tag.kind, 'tag')
  assert.equal(trackEvent(tag, state).gap, false)
})

test('source paths stay repository-relative and Bitbucket denials fail closed', async () => {
  for (const p of ['../a', 'a/../b', '/root', 'x\\y', 'a//b'])
    assert.throws(() => filePath(p))
  assert.equal(filePath('docs/100% #draft?.md'), 'docs/100% #draft?.md')
  assert.throws(() =>
    repositoryContext({
      workspaceId: id,
      extension: { repository: { uuid: id } },
    }),
  )
  assert.throws(() =>
    repositoryContext({
      accountId: 'user',
      workspaceId: id,
      extension: { repository: { uuid: 'other' } },
    }),
  )
  await assert.rejects(
    authorize(async () => json({}, 403)),
    /do not have access/,
  )
})
