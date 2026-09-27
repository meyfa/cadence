import fs from 'node:fs'
import path from 'node:path'

/**
 * Per-directory cache of source files and directories.
 *
 * @type {Map<string, { files: Set<string>, directories: Set<string> }>}
 */
const sourceFilesByDirectory = new Map()

/**
 * Recursively index all files and directories under the package 'src' directory.
 *
 * @param {string} sourceDirectory
 */
function getSourceFiles (sourceDirectory) {
  const cached = sourceFilesByDirectory.get(sourceDirectory)
  if (cached != null) {
    return cached
  }

  const files = new Set()
  const directories = new Set()

  /**
   * @param {string} directory
   */
  const walk = (directory) => {
    let entries
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      const relativePath = path.relative(sourceDirectory, fullPath).split(path.sep).join('/')

      if (entry.isFile()) {
        files.add(relativePath)
        continue
      }

      if (entry.isDirectory()) {
        directories.add(relativePath)
        walk(fullPath)
      }
    }
  }

  walk(sourceDirectory)

  const result = { files, directories }
  sourceFilesByDirectory.set(sourceDirectory, result)

  return result
}

/**
 * Matches the package root ('.../packages/<name>') of a file living under that package's 'test' or
 * 'test-browser' directory.
 */
const packageTestDirectoryPattern = /^(.*[\\/]packages[\\/][^\\/]+)[\\/](?:test|test-browser)[\\/]/

/**
 * Enforce that the title of a top-level 'describe()' block matches the path of the file or directory it tests.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const describeMatchesSourceFile = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that the root describe() title of a test file refers to an existing source file.'
    },
    schema: []
  },

  create (context) {
    const packageRoot = packageTestDirectoryPattern.exec(context.filename)?.at(1)
    if (packageRoot == null) {
      return {}
    }

    const sourceDirectory = path.join(packageRoot, 'src')

    const astPath = 'Program > ExpressionStatement > CallExpression[callee.name="describe"]'

    const listener = (/** @type {import('estree').CallExpression} */ node) => {
      const titleNode = node.arguments.at(0)
      if (titleNode == null || titleNode.type !== 'Literal' || typeof titleNode.value !== 'string') {
        return
      }

      const title = titleNode.value

      const { files, directories } = getSourceFiles(sourceDirectory)
      if (files.has(title) || directories.has(title)) {
        return
      }

      context.report({
        node: titleNode,
        message: `describe() title "${title}" does not match any file or directory in src/.`
      })
    }

    return { [astPath]: listener }
  }
}

export default {
  rules: {
    'describe-matches-source-file': describeMatchesSourceFile
  }
}
