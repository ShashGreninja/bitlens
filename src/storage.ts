import { kvs, WhereConditions } from '@forge/kvs'
import type { Ref, Results } from '../shared/types'
import { digest, refKey, trackEvent, type Recorded } from './domain'

type Baseline = { date: string; refs: Ref[]; partial: boolean }
type RefListing = { refs: Ref[]; partial: boolean }
type ReplayCursor = {
  cursor: string
  since: string | null
  pointers: [string, string | null][]
  partial: boolean
}

export class RepositoryStorage {
  constructor(private readonly prefix: string) {}

  async saveCursor<T>(scope: string, data: T) {
    const token = digest([scope, data])
    await kvs.set(
      this.prefix + ':page:' + token,
      { scope, data },
      { ttl: { value: 1, unit: 'HOURS' } },
    )
    return token
  }

  async loadCursor<T>(scope: string, token: unknown): Promise<T> {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      throw new Error('Invalid continuation.')
    const record = await kvs.get<{ scope: string; data: T }>(
      this.prefix + ':page:' + token,
    )
    if (!record || record.scope !== scope)
      throw new Error(
        'This page expired or belongs to another selection. Refresh the view.',
      )
    return record.data
  }

  private eventKey(event: Recorded) {
    return this.prefix + ':event:' + event.date + ':' + event.id
  }

  async append(event: Recorded) {
    // Identical trigger retries write identical content to the same key. Late
    // deliveries sort at their event time, independently of ingestion time.
    await kvs.set(this.eventKey(event), event)
  }

  async initialize(list: RefListing) {
    const readyKey = this.prefix + ':initialized'
    if (await kvs.get(readyKey)) return
    const key = this.prefix + ':baseline'
    let baseline = await kvs.get<Baseline>(key)
    if (!baseline) {
      const observed = { ...list, date: new Date().toISOString() }
      try {
        await kvs.set(key, observed, { keyPolicy: 'FAIL_IF_EXISTS' })
        baseline = observed
      } catch (error) {
        baseline = await kvs.get<Baseline>(key)
        if (!baseline) throw error
      }
    }
    // A concurrent or interrupted bootstrap always resumes the same observation.
    const events = baseline.refs.map((r): Recorded => ({
      id: digest(['snapshot', baseline.date, r.kind, r.name, r.hash]),
      date: baseline.date,
      ref: r.name,
      refType: r.kind,
      kind: 'snapshot',
      before: null,
      after: r.hash,
      actor: 'bitlens',
    }))
    for (let start = 0; start < events.length; start += 25) {
      const batch = events
        .slice(start, start + 25)
        .map((event) => ({ key: this.eventKey(event), value: event }))
      const result = await kvs.batchSet(batch)
      if (result.failedKeys.length)
        throw new Error(
          'The initial pointer snapshot is incomplete. Reopen bitlens to resume.',
        )
    }
    await kvs.set(readyKey, true)
  }

  async replay(
    token: string | undefined,
    currentRefs: () => Promise<RefListing>,
  ): Promise<Results['replay']> {
    const prior = token
      ? await this.loadCursor<ReplayCursor>('replay', token)
      : undefined
    const baseline = await kvs.get<Baseline>(this.prefix + ':baseline')
    let query = kvs
      .query()
      .where('key', WhereConditions.beginsWith(this.prefix + ':event:'))
      .limit(35)
    if (prior) query = query.cursor(prior.cursor)
    const page = await query.getMany<Recorded>()
    const pointers = new Map(prior?.pointers)
    const events = page.results.map((row) => trackEvent(row.value, pointers))
    const since =
      prior?.since ||
      [baseline?.date, events[0]?.date]
        .filter((s): s is string => !!s)
        .sort()[0] ||
      null
    const warnings: string[] = []
    let partial = Boolean(prior?.partial || baseline?.partial)
    // Bound cursor storage even in repositories with very high ref churn.
    while (pointers.size > 320) {
      pointers.delete(pointers.keys().next().value!)
      partial = true
    }
    if (partial)
      warnings.push('Pointer coverage is partial for this repository.')
    if (events.some((e) => e.gap))
      warnings.push('Recorded pointer changes contain a gap.')
    let next: string | undefined
    if (page.nextCursor) {
      next = await this.saveCursor<ReplayCursor>('replay', {
        cursor: page.nextCursor,
        since,
        pointers: [...pointers],
        partial,
      })
    } else {
      const current = await currentRefs()
      const live = new Map(
        current.refs.map((r) => [refKey(r.kind, r.name), r.hash]),
      )
      const differs =
        [...live].some(([name, hash]) => pointers.get(name) !== hash) ||
        (!current.partial &&
          [...pointers].some(([name, hash]) => hash && !live.has(name)))
      if (differs)
        warnings.push(
          'Current Bitbucket refs differ from the recorded pointers. Delivery may be delayed or incomplete.',
        )
      if (current.partial && !partial)
        warnings.push('Only a subset of current refs could be checked.')
    }
    return { since, events, next, warning: warnings.join(' ') || undefined }
  }
}
