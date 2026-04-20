import type { Tree } from '@lezer/common'

export interface TextLike {
  readonly length: number
  readonly sliceString: (from: number, to?: number) => string
}

export interface WordRange {
  readonly from: number
  readonly to: number
}

const IDENTIFIER_KINDS = [
  'VariableName',
  'Callee',
  'MemberAccess',
  'PropertyName',
  'VariableDefinition',
  'UseAlias'
] as const

export type IdentifierKind = typeof IDENTIFIER_KINDS[number]

export function isIdentifierKind (value: string): value is IdentifierKind {
  return IDENTIFIER_KINDS.includes(value as IdentifierKind)
}

const WORD_REGEXP = /[a-zA-Z_0-9#]/

export function isWordChar (char: string): boolean {
  return char.length === 1 && WORD_REGEXP.test(char)
}

export function charAt (document: TextLike, index: number): string {
  return index >= 0 && index < document.length ? document.sliceString(index, index + 1) : ''
}

export function getWordRangeAt (document: TextLike, position: number): WordRange | undefined {
  if (position < 0 || position > document.length) {
    return undefined
  }

  // Prefer the character under the cursor; fall back to the left neighbor.
  const right = charAt(document, position)
  const left = charAt(document, position - 1)
  const anchor = isWordChar(right) ? position : (isWordChar(left) ? position - 1 : undefined)
  if (anchor == null) {
    return undefined
  }

  let from = anchor
  while (from > 0 && isWordChar(charAt(document, from - 1))) {
    --from
  }

  let to = anchor + 1
  while (to < document.length && isWordChar(charAt(document, to))) {
    ++to
  }

  return { from, to }
}

export function findIdentifierRangeAt (tree: Tree, document: TextLike, position: number): WordRange | undefined {
  const maxDepth = 8
  let node = tree.resolveInner(position, -1)

  // Climb to a meaningful identifier wrapper node.
  for (let depth = 0; depth < maxDepth && node.parent != null; ++depth) {
    if (isIdentifierKind(node.type.name)) {
      return { from: node.from, to: node.to }
    }
    node = node.parent
  }

  return getWordRangeAt(document, position)
}
