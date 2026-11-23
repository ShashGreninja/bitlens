const { validate } = require('@forge/manifest')

async function check() {
  const result = await validate()
  if (result.success) {
    console.log('Forge manifest and resource paths are valid.')
    return
  }
  for (const error of result.errors) {
    console.error(`manifest.yml:${error.line}:${error.column} ${error.message}`)
  }
  process.exitCode = 1
}

check().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
