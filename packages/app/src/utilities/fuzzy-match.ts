export interface FuzzyMatchResult {
  readonly indices: number[]
}

// Remove accents from a string by normalizing to NFD and removing combining marks
function removeAccents (str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function fuzzyMatch (options: {
  readonly text: string
  readonly query: string
}): FuzzyMatchResult | undefined {
  const { text: inputText, query: inputQuery } = options

  const query = removeAccents(inputQuery.replace(/\s+/g, ''))
  if (query.length === 0) {
    return undefined
  }

  const text = removeAccents(inputText)
  if (text.length < query.length) {
    return undefined
  }

  const indices: number[] = []
  let queryIndex = 0

  for (let textIndex = 0; textIndex < text.length; ++textIndex) {
    if (text[textIndex] === query[queryIndex]) {
      indices.push(textIndex)
      if (++queryIndex === query.length) {
        return { indices }
      }
    }
  }

  return undefined
}
