import type { WorkbenchData, WorkbenchRequest } from '../../shared/workbench'
import { isExample } from './service'

export async function workbenchService(input: WorkbenchRequest): Promise<WorkbenchData | { message: string }> {
  if (isExample) {
    if (input.op !== 'load') throw new Error('Repository actions are available in the installed Bitbucket app only.')
    return {
      reviews: [], pipelines: [], reviewMore: false, pipelineMore: false,
      warnings: [], fetchedAt: new Date().toISOString(), preview: true,
    }
  }
  const { invoke } = await import('@forge/bridge')
  const result = await invoke<WorkbenchData | { message: string }>('workbench', input)
  return 'body' in result ? result.body : result
}
