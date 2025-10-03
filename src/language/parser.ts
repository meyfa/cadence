import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'

function literal (name: string): p.Parser<Token, unknown, true> {
  return p.token((t) => t.name === name ? true : undefined)
}

type PatternItem = 'rest' | 'hit'
type Pattern = PatternItem[]

const patternChar_: p.Parser<Token, unknown, PatternItem> = p.eitherOr(
  p.token((t) => t.name === '-' ? 'rest' : undefined),
  p.token((t) => t.name === 'char' ? 'hit' : undefined)
)

const patternLiteral_: p.Parser<Token, unknown, PatternItem[]> = p.middle(
  literal('['),
  p.many(patternChar_),
  literal(']')
)

export type ParseResult = {
  complete: false
  value: undefined
} | {
  complete: true
  value: Pattern
}

export function parse (input: string): ParseResult {
  const lexerResult = lex(input)
  if (!lexerResult.complete) {
    return {
      complete: false,
      value: undefined
    }
  }

  const value = p.tryParse(patternLiteral_, lexerResult.tokens, {})
  if (value == null) {
    return {
      complete: false,
      value: undefined
    }
  }

  return {
    complete: true,
    value
  }
}
