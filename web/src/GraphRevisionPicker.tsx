import type { Ref } from '../../shared/types'

const refValue = (ref: Ref) => `${ref.kind}:${ref.name}`

export function graphRevision(
  refs: Ref[],
  defaultBranch?: string,
  hash?: string,
) {
  const branch = refs.find(
    (ref) => ref.kind === 'branch' && ref.name === defaultBranch,
  )
  if (hash) {
    const ref =
      branch?.hash === hash ? branch : refs.find((ref) => ref.hash === hash)
    return ref ? refValue(ref) : hash
  }
  const start = branch || refs[0]
  return start ? refValue(start) : ''
}

export function graphRevisionHash(refs: Ref[], revision: string) {
  return refs.find((ref) => refValue(ref) === revision)?.hash ?? revision
}

export function GraphRevisionPicker({
  refs,
  revision,
  onChange,
  label = 'Starting revision',
}: {
  refs: Ref[]
  revision: string
  onChange: (revision: string) => void
  label?: string
}) {
  return (
    <label>
      {label}
      <select
        value={revision}
        onChange={(event) => onChange(event.target.value)}
        disabled={!revision}
      >
        {!revision && <option value="">No branches or tags</option>}
        {revision && !refs.some((ref) => refValue(ref) === revision) && (
          <option value={revision}>Commit {revision.slice(0, 8)}</option>
        )}
        {(['branch', 'tag'] as const).map((kind) => {
          const options = refs.filter((ref) => ref.kind === kind)
          if (!options.length) return null
          return (
            <optgroup key={kind} label={kind === 'branch' ? 'Branches' : 'Tags'}>
              {options.map((ref) => (
                <option key={refValue(ref)} value={refValue(ref)}>
                  {ref.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </label>
  )
}
