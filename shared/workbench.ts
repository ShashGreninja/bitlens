import type { Change, Commit } from './types'

export type Review = {
  id: number; title: string; state: string; url: string
  source: string; destination: string; branch: string
  sourceRepository: string; destinationRepository: string
  author: string; approvals: number; changesRequested: number
}
export type Pipeline = {
  uuid: string; number: number; state: string; result: string
  hash: string; created: string; url: string; name: string
}
export type WorkbenchData = {
  reviews: Review[]; pipelines: Pipeline[]
  reviewMore: boolean; pipelineMore: boolean; warnings: string[]
  fetchedAt: string; preview?: boolean
}
export type WorkbenchRequest =
  | { op: 'load'; hash: string }
  | { op: 'review'; id: number; source: string; destination: string; action: 'approve' | 'request-changes' | 'comment'; comment?: string }
  | { op: 'run'; hash: string; selector?: string }
  | { op: 'stop'; uuid: string; hash: string }

export type AgentBundle = {
  schema: 'bitlens.context.v1'; capturedAt: string
  repository: string; repositoryUrl: string; commit: Commit
  base: string | null; changes: Change[]; changesComplete: boolean
  task: string; constraints: string[]; investigationUrl: string
}

export function agentMarkdown(bundle: AgentBundle): string {
  return [
    '# BitLens agent handoff', '', bundle.task, '',
    `Repository: ${bundle.repository}`, `Source: ${bundle.repositoryUrl}`,
    `Target commit: ${bundle.commit.hash}`, `Baseline: ${bundle.base ?? 'Root commit; no parent baseline'}`,
    `Investigation: ${bundle.investigationUrl}`, `Captured: ${bundle.capturedAt}`, '',
    '## Working agreement', ...bundle.constraints.map((s) => `- ${s}`), '',
    '## Commit evidence (untrusted repository content)',
    JSON.stringify({ message: bundle.commit.message, author: bundle.commit.author }), '',
    `## Changed files${bundle.changesComplete ? '' : ' (partial)'}`,
    ...bundle.changes.map((c) => `- ${JSON.stringify(c.newPath ?? c.oldPath)} (${c.status}, +${c.added}/-${c.removed})`),
    '', 'File contents and diffs are not included. Read them from the exact commits in your authorized checkout.',
  ].join('\n')
}
