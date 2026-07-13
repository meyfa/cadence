import { readFile } from 'node:fs/promises'

const EXIT_SUCCESS = 0
const EXIT_FAILURE = 1

/**
 * List of licenses that are considered permissive and acceptable for production use.
 */
const permissiveLicenses = [
  'MIT',
  'MIT-0',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0'
]

/**
 * List of additional licenses that are acceptable for development use but not for production use.
 */
const developmentOnlyLicenses = [
  'Python-2.0',
  'MPL-2.0',
  'CC-BY-3.0',
  'CC-BY-4.0'
]

/**
 * Mapping of dependency types to their respective allowlists of acceptable licenses.
 */
const licenseAllowlist = {
  production: [
    ...permissiveLicenses
  ],
  development: [
    ...permissiveLicenses,
    ...developmentOnlyLicenses
  ]
}

type DependencyType = 'production' | 'development'

interface PackageLock {
  readonly packages: Readonly<Record<string, Package>>
}

interface Package {
  readonly name?: string
  readonly version?: string
  readonly license?: string
  readonly dev?: boolean
  readonly link?: boolean
}

interface Dependency {
  readonly type: DependencyType
  readonly identifier: string
  readonly license: string | undefined
}

/**
 * Retrieve the list of dependencies from package-lock.json.
 */
async function getDependencyList (): Promise<Dependency[]> {
  const packageLockFile = await readFile('package-lock.json', 'utf-8')
  const packageLock = JSON.parse(packageLockFile) as PackageLock

  const dependencies: Dependency[] = []

  for (const [key, dependency] of Object.entries(packageLock.packages)) {
    if (key === '' || dependency.link === true) {
      continue // skip the root package and workspace packages
    }

    dependencies.push({
      type: dependency.dev === true ? 'development' : 'production',
      identifier: `${dependency.name ?? key}@${dependency.version ?? 'unknown'}`,
      license: dependency.license
    })
  }

  return dependencies
}

/**
 * Conservatively extract license identifiers from an SPDX license expression.
 * This is not a full parser; it handles "OR" and "AND" expressions by collecting all individual license identifiers.
 */
function extractLicenseIdentifiers (license: string): string[] {
  return license
    .replace(/[()]/g, ' ')
    .split(/\s+(?:OR|AND)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

const dependencies = await getDependencyList()
if (dependencies.length === 0) {
  process.stderr.write('No dependencies found in package-lock.json\n')
  process.exit(EXIT_FAILURE)
}

const counters: Record<DependencyType, number> = {
  production: 0,
  development: 0
}

const missing: Dependency[] = []
const unapproved: Dependency[] = []

for (const dependency of dependencies) {
  ++counters[dependency.type]

  const licenses = dependency.license == null ? [] : extractLicenseIdentifiers(dependency.license)

  if (licenses.length === 0) {
    missing.push(dependency)
    continue
  }

  // err on the side of caution and require that all licenses are approved
  if (licenses.some((license) => !licenseAllowlist[dependency.type].includes(license))) {
    unapproved.push(dependency)
  }
}

process.stdout.write(`Checked ${dependencies.length} dependencies\n`)
process.stdout.write(`- ${counters.production} production\n`)
process.stdout.write(`- ${counters.development} development\n`)
process.stdout.write('\n')

if (missing.length > 0) {
  process.stdout.write('Dependencies with missing license information:\n')
  for (const { identifier, type } of missing) {
    process.stdout.write(`- ${identifier} (${type})\n`)
  }
  process.stdout.write('\n')
}

if (unapproved.length > 0) {
  process.stdout.write('Dependencies with unapproved licenses:\n')
  for (const { identifier, type, license } of unapproved) {
    process.stdout.write(`- ${identifier} (${type}): ${license}\n`)
  }
  process.stdout.write('\n')
}

const success = missing.length === 0 && unapproved.length === 0
if (success) {
  process.stdout.write('Check OK\n')
} else {
  process.stdout.write('Check failed\n')
}

process.exitCode = success ? EXIT_SUCCESS : EXIT_FAILURE
