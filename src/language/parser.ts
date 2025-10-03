import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'

interface TrackBlock {
  tempo?: number
}

type PatternItem = 'rest' | 'hit'
type Pattern = PatternItem[]

interface Assignment {
  key: string
  value: Pattern
}

interface Program {
  track?: TrackBlock
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

const number_: p.Parser<Token, unknown, number> = p.map(
  p.token((t) => t.name === 'number' ? t.text : undefined),
  (text) => Number.parseFloat(text)
)

const assignment_: p.Parser<Token, unknown, Assignment> = p.abc(
  identifier_,
  literal('='),
  patternLiteral_,
  (key, _eq, value) => ({ key, value })
)

const property_: p.Parser<Token, unknown, { key: string, value: number }> = p.abc(
  identifier_,
  literal(':'),
  number_,
  (key, _colon, value) => ({ key, value })
)

const trackBlock_: p.Parser<Token, unknown, TrackBlock> = p.right(
  p.token((t) => t.name === 'identifier' && t.text === 'track' ? true : undefined),
  p.middle(
    literal('{'),
    p.map(
      p.many(property_),
      (properties) => {
        const block: TrackBlock = {}
        for (const property of properties) {
          if (property.key === 'tempo') {
            block.tempo = property.value
          }
        }
        return block
      }
    ),
    literal('}')
  )
)

const program_: p.Parser<Token, unknown, Program> = p.left(
  p.map(
    p.many(
      p.eitherOr(trackBlock_, assignment_)
    ),
    (statements) => {
      console.log(statements)

      const patterns: Record<string, Pattern> = {}
      let track: TrackBlock | undefined

      for (const statement of statements) {
        if ('key' in statement) {
          patterns[statement.key] = statement.value
          continue
        }

        track = statement
      }

      return { track, patterns }
    }
  ),
  p.end
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
