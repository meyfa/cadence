const EXIT_SUCCESS = 0
const EXIT_FAILURE = 1

const types = [
  'feat',
  'fix',
  'refactor',
  'chore',
  'docs',
  'test'
]

const scopes = [
  'deps'
]

const limit = 72

function validateMessage (message: string): readonly string[] {
  const errors: string[] = []

  if (message.trim() === '') {
    errors.push('Commit message cannot be empty')
    return errors
  }

  if (message.length > limit) {
    errors.push(`Commit message length ${message.length} exceeds ${limit} characters`)
  }

  const match = /^([a-z]+)(\([^)]*\))?(!)?: (.+)$/i.exec(message)

  if (match === null) {
    errors.push('Commit message does not match the required format: <type>[scope][!]: <description>')
    return errors
  }

  const type = match.at(1)
  const scope = match.at(2)?.slice(1, -1)
  const description = match.at(-1)

  if (type == null || !types.includes(type)) {
    errors.push(`Invalid type '${type}'. Allowed types are: ${types.join(', ')}`)
  }

  if (scope != null && !scopes.includes(scope)) {
    errors.push(`Invalid scope '${scope}'. Allowed scopes are: ${scopes.join(', ')}`)
  }

  if (description == null || description.trim() === '') {
    errors.push('Description cannot be empty')
  } else if (description.trim() !== description) {
    errors.push('Description cannot have leading or trailing whitespace')
  }

  return errors
}

const commitMessage = process.argv.at(2) ?? ''
process.stdout.write(`Validating commit message: "${commitMessage}"\n`)

const errors = validateMessage(commitMessage)

if (errors.length === 0) {
  process.stdout.write('Valid\n')
  process.exitCode = EXIT_SUCCESS
} else {
  process.stderr.write('Invalid:\n')
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`)
  }
  process.exitCode = EXIT_FAILURE
}
