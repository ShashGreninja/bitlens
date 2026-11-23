import test from 'node:test'
import assert from 'node:assert/strict'
import { kvs } from '@forge/kvs'
import { RepositoryStorage } from '../src/storage'
import type { Ref } from '../shared/types'

test('interrupted snapshot resumes the original observation and keeps repository cursors isolated', async (t) => {
  const records = new Map<string, unknown>()
  let interrupt = true
  t.mock.method(kvs, 'get', async (key: string) => records.get(key))
  t.mock.method(
    kvs,
    'set',
    async (key: string, value: unknown, options?: { keyPolicy?: string }) => {
      if (options?.keyPolicy === 'FAIL_IF_EXISTS' && records.has(key))
        throw Error('Exists')
      records.set(key, value)
    },
  )
  t.mock.method(
    kvs,
    'batchSet',
    async (batch: { key: string; value: unknown }[]) => {
      if (interrupt) {
        interrupt = false
        records.set(batch[0].key, batch[0].value)
        return { failedKeys: [batch[1].key] }
      }
      for (const row of batch) records.set(row.key, row.value)
      return { failedKeys: [] }
    },
  )
  const storage = new RepositoryStorage('rh:workspace:first')
  const refs: Ref[] = [
    { kind: 'branch', name: 'main', hash: 'a'.repeat(40) },
    { kind: 'tag', name: 'release', hash: 'b'.repeat(40) },
  ]
  await assert.rejects(
    storage.initialize({ refs, partial: false }),
    /incomplete/,
  )
  await storage.initialize({ refs: [], partial: false })
  await storage.initialize({ refs: [], partial: false })
  assert.equal(
    [...records.keys()].filter((key) => key.includes(':event:')).length,
    2,
  )

  const cursor = await storage.saveCursor('same-query', { page: 2 })
  assert.deepEqual(await storage.loadCursor('same-query', cursor), { page: 2 })
  await assert.rejects(
    storage.loadCursor('different-query', cursor),
    /another selection/,
  )
  const elsewhere = new RepositoryStorage('rh:workspace:second')
  await assert.rejects(
    elsewhere.loadCursor('same-query', cursor),
    /another selection/,
  )
})
