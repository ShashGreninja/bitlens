import type { Pipeline, Review, WorkbenchData, WorkbenchRequest } from '../shared/workbench'
import { fullHash } from './gitRecords'
import { BitbucketError } from './history'

export type RequestRepo = (path: string, method?: 'GET' | 'POST', body?: unknown) => Promise<{
  ok: boolean; status: number; json(): Promise<unknown>
}>
type ApiPR = {
  id: number; title: string; state: string; author?: { display_name: string }
  source: { commit: { hash: string }; branch: { name: string }; repository: { uuid: string } }
  destination: { commit: { hash: string }; repository: { uuid: string } }
  participants?: { approved?: boolean; state?: string }[]
  links?: { html?: { href: string } }
}
type ApiPipeline = {
  uuid: string; build_number: number; created_on: string
  state: { name: string; result?: { name: string } }
  target?: { commit?: { hash: string }; selector?: { pattern: string } }
}
async function read<T>(request: RequestRepo, path: string): Promise<T> {
  const result = await request(path)
  if (!result.ok) throw new BitbucketError(result.status)
  return await result.json() as T
}
async function write(request: RequestRepo, path: string, body?: unknown) {
  // A transport error or a 5xx can follow a successful upstream mutation.
  // Never retry automatically; require the person to reconcile in Bitbucket.
  let result
  try { result = await request(path, 'POST', body) }
  catch { throw new Error('Outcome unknown. Check Bitbucket before trying again; the action may have completed.') }
  if (result.status >= 500) throw new Error('Outcome unknown. Check Bitbucket before trying again; the action may have completed.')
  if (!result.ok) throw new BitbucketError(result.status)
  return { message: 'Bitbucket accepted the action. Refresh to check the latest state.' }
}
function review(pr: ApiPR): Review {
  return {
    id: pr.id, title: pr.title, state: pr.state, url: pr.links?.html?.href ?? '',
    source: pr.source.commit.hash, destination: pr.destination.commit.hash,
    branch: pr.source.branch.name, sourceRepository: pr.source.repository.uuid,
    destinationRepository: pr.destination.repository.uuid,
    author: pr.author?.display_name ?? 'Unknown author',
    approvals: pr.participants?.filter((p) => p.approved).length ?? 0,
    changesRequested: pr.participants?.filter((p) => p.state === 'changes_requested').length ?? 0,
  }
}
const sameRepo = (a: string, b: string) => a.replace(/[{}]/g, '').toLowerCase() === b.replace(/[{}]/g, '').toLowerCase()

export async function workbench(input: WorkbenchRequest, request: RequestRepo, repositoryUuid: string, webUrl: string): Promise<WorkbenchData | { message: string }> {
  if (!input || typeof input !== 'object') throw new Error('Choose a repository operation.')
  if (input.op === 'load') {
    const hash = fullHash(input.hash)
    const results = await Promise.allSettled([
      read<{ values: ApiPR[]; next?: string }>(request, `/commit/${hash}/pullrequests?pagelen=50`),
      read<{ values: ApiPipeline[]; next?: string }>(request, `/pipelines/?pagelen=30&sort=-created_on&target.commit.hash=${hash}`),
    ])
    const data: WorkbenchData = { reviews: [], pipelines: [], reviewMore: false, pipelineMore: false, warnings: [], fetchedAt: new Date().toISOString() }
    const [prs, runs] = results
    if (prs.status === 'fulfilled') {
      data.reviews = prs.value.values.map(review)
      data.reviewMore = Boolean(prs.value.next)
    } else data.warnings.push('Reviews: ' + String(prs.reason instanceof Error ? prs.reason.message : prs.reason))
    if (runs.status === 'fulfilled') {
      data.pipelines = runs.value.values.map((p): Pipeline => ({
        uuid: p.uuid, number: p.build_number, created: p.created_on,
        state: p.state.name, result: p.state.result?.name ?? '', hash: p.target?.commit?.hash ?? '',
        name: p.target?.selector?.pattern ?? 'Default pipeline',
        url: `${webUrl}/pipelines/results/${p.build_number}`,
      })).filter((p) => p.hash === hash)
      data.pipelineMore = Boolean(runs.value.next)
    } else data.warnings.push('Pipelines: ' + String(runs.reason instanceof Error ? runs.reason.message : runs.reason))
    return data
  }
  if (input.op === 'review') {
    if (!Number.isSafeInteger(input.id) || input.id < 1) throw new Error('Invalid pull request.')
    const source = fullHash(input.source), destination = fullHash(input.destination)
    if (!['approve', 'request-changes', 'comment'].includes(input.action)) throw new Error('Invalid review action.')
    if (input.action === 'comment' && (typeof input.comment !== 'string' || !input.comment.trim() || input.comment.length > 10000)) throw new Error('Write a comment of 1–10,000 characters.')
    const pr = await read<ApiPR>(request, `/pullrequests/${input.id}`)
    if (!sameRepo(pr.destination.repository.uuid, repositoryUuid)) throw new Error('Pull request repository mismatch.')
    if (pr.state !== 'OPEN' || pr.source.commit.hash !== source || pr.destination.commit.hash !== destination) throw new Error('This pull request changed since you loaded it. Refresh and review the new revisions before submitting.')
    return write(request, `/pullrequests/${input.id}/${input.action === 'comment' ? 'comments' : input.action}`,
      input.action === 'comment' ? { content: { raw: `${input.comment!.trim()}\n\n_Reviewed with BitLens at source ${source}, destination ${destination}._` } } : undefined)
  }
  if (input.op === 'run') {
    const hash = fullHash(input.hash)
    if (input.selector !== undefined && (typeof input.selector !== 'string' || !input.selector.trim() || input.selector.length > 200 || /[\x00-\x1f]/.test(input.selector))) throw new Error('Enter a valid custom pipeline name.')
    await read(request, `/commit/${hash}`)
    return write(request, '/pipelines/', { target: {
      type: 'pipeline_commit_target', commit: { type: 'commit', hash },
      selector: input.selector ? { type: 'custom', pattern: input.selector.trim() } : { type: 'default' },
    } })
  }
  if (input.op === 'stop') {
    const hash = fullHash(input.hash)
    if (typeof input.uuid !== 'string' || !/^\{[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\}$/i.test(input.uuid)) throw new Error('Invalid pipeline identifier.')
    const path = `/pipelines/${encodeURIComponent(input.uuid)}`
    const run = await read<ApiPipeline>(request, path)
    if (run.target?.commit?.hash !== hash) throw new Error('Pipeline commit mismatch. Refresh the selected revision.')
    if (!['PENDING', 'IN_PROGRESS'].includes(run.state.name)) throw new Error('This pipeline is no longer running. Refresh its status.')
    return write(request, `${path}/stopPipeline`)
  }
  throw new Error('Unknown repository operation.')
}
