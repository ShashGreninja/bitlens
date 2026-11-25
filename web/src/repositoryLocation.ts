import { repositoryName } from '../../shared/repositoryName'

export function previewRepository() {
  const value = new URLSearchParams(window.location.search).get('repo')
  return value ? repositoryName(value) : undefined
}

export function previewUrl(repository?: string) {
  const url = new URL(window.location.pathname, window.location.origin)
  if (repository) url.searchParams.set('repo', repository)
  return url
}
