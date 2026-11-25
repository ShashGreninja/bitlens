const slugs = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i

export function repositoryName(input: string): string {
  let name = input.trim().replace(/\/$/, '')
  if (name.startsWith('https://')) {
    if (!URL.canParse(name)) throw new Error('Enter a valid Bitbucket Cloud URL.')
    const url = new URL(name)
    if (url.origin !== 'https://bitbucket.org' || url.username || url.password)
      throw new Error('Enter a Bitbucket Cloud repository URL.')
    name = url.pathname.split('/').slice(1, 3).join('/')
  }
  if (name.endsWith('.git')) name = name.slice(0, -4)
  if (!slugs.test(name))
    throw new Error('Enter a Bitbucket URL or a workspace/repository name.')
  return name.toLowerCase()
}
