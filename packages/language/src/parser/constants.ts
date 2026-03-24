export const keywords = Object.freeze([
  'use',
  'as',
  'track',
  'part',
  'for',
  'mixer',
  'bus',
  'effect',
  'automate'
] as const)

export type Keyword = (typeof keywords)[number]

const keywordSet = new Set<string>(keywords)

export function isKeyword (str: string): str is Keyword {
  return keywordSet.has(str)
}
