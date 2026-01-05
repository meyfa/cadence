export const keywords = Object.freeze([
  'track',
  'section',
  'for',
  'mixer',
  'bus',
  'effect'
] as const)

export type Keyword = (typeof keywords)[number]

const keywordSet = new Set<string>(keywords)

export function isKeyword (str: string): str is Keyword {
  return keywordSet.has(str)
}
