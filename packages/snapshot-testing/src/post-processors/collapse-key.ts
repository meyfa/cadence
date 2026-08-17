import type { PostProcessor } from '../types.ts'

/**
 * Create a post-processing function that collapses a specific key to a single line.
 * This is intended to reduce the output size and make it easier to read.
 */
export function collapseKey (key: string): PostProcessor {
  const startString = JSON.stringify(key) + ': {'
  const endRegex = /^ +[},]$/

  return (json) => {
    const inputLines: readonly string[] = json.split('\n')
    const outputLines: string[] = []

    for (let index = 0; index < inputLines.length; ++index) {
      const line = inputLines[index]

      if (!line.endsWith(startString)) {
        outputLines.push(line)
        continue
      }

      let endIndex = index + 1
      while (endIndex < inputLines.length && !endRegex.test(inputLines[endIndex])) {
        ++endIndex
      }

      const begin = line
      const middle = inputLines.slice(index + 1, endIndex).map((line) => line.trim()).join(' ')
      const end = inputLines[endIndex].trim()

      outputLines.push(`${begin}${middle}${end}`)
      index = endIndex
    }

    return outputLines.join('\n')
  }
}
