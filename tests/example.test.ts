import assert from 'node:assert/strict'
import test from 'node:test'
import { exampleService as service } from '../web/src/example'

const base = 'v1.4'
const target = 'v1.5'
const path = 'services/payments/config.yml'
const oldPath = 'payments/config.yml'

test('the sample compares actual hashes, ref names and reversed endpoints', async () => {
  const forward = await service('compare', { base, target })
  const backward = await service('compare', {
    base: forward.target,
    target: forward.base,
  })
  assert.equal(forward.changes.length, 4)
  for (const change of forward.changes) {
    const reverse = backward.changes.find(
      (item) =>
        item.oldPath === change.newPath && item.newPath === change.oldPath,
    )
    assert.ok(reverse)
    assert.equal(
      reverse.status,
      ({ added: 'removed', removed: 'added' } as Record<string, string>)[
        change.status
      ] || change.status,
    )
    assert.equal(reverse.added, change.removed)
    assert.equal(reverse.removed, change.added)
  }
  assert.equal(
    (await service('compare', { base: forward.base, target: forward.base }))
      .changes.length,
    0,
  )
  assert.deepEqual(
    await service('compare', { base: forward.base, target: forward.target }),
    forward,
  )
  await assert.rejects(service('compare', { base: 'missing' }), /unavailable/)
})

test('the directional patch, historical paths and illustrative landing PR agree', async () => {
  const detail = await service('detail', { base, target, path, oldPath })
  assert.match(detail.diff, /rename from payments\/config.yml/)
  assert.match(detail.diff, /-timeout_ms: 1800\n\+timeout_ms: 600/)
  assert.deepEqual(
    detail.history.map((rev) => rev.path),
    [path, oldPath, oldPath],
  )
  assert.equal(detail.history[0].pr?.id, 42)
  assert.match(detail.history[0].pr!.title, /Illustrative/)
  const reverse = await service('detail', {
    base: target,
    target: base,
    path: oldPath,
    oldPath: path,
  })
  assert.match(reverse.diff, /-timeout_ms: 600\n\+timeout_ms: 1800/)
  assert.equal(reverse.history[0].path, oldPath)
  const deleted = await service('detail', {
    base,
    target,
    path: 'payments/legacy.env',
    deleted: true,
  })
  assert.match(deleted.diff, /deleted file mode/)
  assert.equal(deleted.history.length, 1)
  await assert.rejects(
    service('detail', { base, target, path: oldPath }),
    /unavailable/,
  )
})

test('the selected graph draws genuine parents and excludes unmerged source ancestry', async () => {
  const { commits } = await service('graph', { base, target })
  const merged = commits.find(
    (commit) => commit.message === 'Merge the payment incident runbook',
  )!
  const { history } = await service('detail', { base, target, path })
  const landing = commits.find((commit) => commit.hash === history[0].hash)!
  assert.deepEqual(landing.parents, [merged.hash])
  assert.equal(merged.parents.length, 2)
  const docs = await service('detail', {
    base,
    target,
    path: 'docs/payment-runbook.md',
  })
  assert.equal(docs.history[0].pr?.id, 41)
  const preMerge = await service('detail', {
    base,
    target: 'docs/payment-runbook',
    path: 'docs/payment-runbook.md',
  })
  assert.equal(preMerge.history[0].pr, undefined)
  assert.ok(
    merged.parents.every((parent) =>
      commits.some((commit) => commit.hash === parent),
    ),
  )
  assert.ok(
    !commits.some(
      (commit) => commit.message === 'Reduce the gateway timeout to 600 ms',
    ),
  )
  assert.ok(
    commits.every((commit) =>
      commit.parents.every(
        (parent) =>
          commits.findIndex((c) => c.hash === parent) > commits.indexOf(commit),
      ),
    ),
  )
})

test('replay retains the last deleted pointer and both sides of a non-fast-forward', async () => {
  const { events, since } = await service('replay')
  assert.equal(events[0].date, since)
  assert.equal(events[0].kind, 'snapshot')
  assert.ok(
    events.every((event, i) => i === 0 || events[i - 1].date <= event.date),
  )
  assert.equal(new Set(events.map((event) => event.id)).size, events.length)
  const deletion = events.find((event) => event.kind === 'delete')!
  const lastPush = events
    .filter((event) => event.ref === deletion.ref && event.date < deletion.date)
    .at(-1)!
  assert.equal(lastPush.after, deletion.before)
  assert.equal(deletion.after, null)
  const forced = events.find((event) => event.kind === 'force-push')!
  const before = await service('graph', {
    base: forced.before!,
    target: forced.before!,
  })
  const after = await service('graph', {
    base: forced.after!,
    target: forced.after!,
  })
  assert.ok(!after.commits.some((commit) => commit.hash === forced.before))
  assert.deepEqual(before.commits[0].parents, after.commits[0].parents)
})

test('directory entries and file evidence resolve against the requested tree', async () => {
  const repo = await service('bootstrap')
  assert.ok(
    repo.refs.some(
      (ref) => ref.kind === 'branch' && ref.name === repo.defaultBranch,
    ),
  )
  const root = await service('tree', { target: base })
  assert.ok(
    root.entries.some((entry) => entry.path === 'payments' && entry.directory),
  )
  const old = await service('tree', { target: base, path: 'payments' })
  const current = await service('tree', { target, path: 'services/payments' })
  assert.ok(old.entries.some((entry) => entry.path === oldPath))
  assert.equal(current.entries[0].path, path)
  assert.match(current.entries[0].url, /^#evidence=source&hash=/)
  await assert.rejects(
    service('tree', { target: base, path: 'services/payments' }),
    /unavailable/,
  )
})
