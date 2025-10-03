import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'

type PatternItem = 'rest' | 'hit'
type Pattern = PatternItem[]

interface Assignment {
  key: string
  value: Pattern
}

interface Program {
  patterns: Record<string, Pattern>
}

function literal (name: string): p.Parser<Token, unknown, true> {
  return p.token((t) => t.name === name ? true : undefined)
}

const patternLiteral_: p.Parser<Token, unknown, Pattern> = p.map(
  p.token((t) => t.name === 'pattern' ? t.text : undefined),
  (text) => {
    return text.slice(1, -1).replace(/\s/g, '').split('').map((char) => {
      return char === '-' ? 'rest' : 'hit'
    })
  }
)

const identifier_: p.Parser<Token, unknown, string> = p.token((t) => t.name === 'identifier' ? t.text : undefined)

const assignment_: p.Parser<Token, unknown, Assignment> = p.abc(
  identifier_,
  literal('='),
  patternLiteral_,
  (key, _eq, value) => ({ key, value })
)

const program_: p.Parser<Token, unknown, Program> = p.map(
  p.many(assignment_),
  (assignments) => {
    const patterns: Record<string, Pattern> = {}
    for (const assignment of assignments) {
      patterns[assignment.key] = assignment.value
    }

    return { patterns }
  }
)

export type ParseResult = {
  complete: false
  value: undefined
} | {
  complete: true
  value: Program
}

export function parse (input: string): ParseResult {
  const lexerResult = lex(input)
  if (!lexerResult.complete) {
    return {
      complete: false,
      value: undefined
    }
  }

  const value = p.tryParse(program_, lexerResult.tokens, {})
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
