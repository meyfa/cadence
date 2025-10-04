import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'
import * as ast from './ast.js'

function literal (name: string): p.Parser<Token, unknown, true> {
  return p.token((t) => t.name === name ? true : undefined)
}

const patternLiteral_: p.Parser<Token, unknown, ast.Pattern> = p.map(
  p.token((t) => t.name === 'pattern' ? t.text : undefined),
  (text) => {
    const steps = text.slice(1, -1).replace(/\s/g, '').split('').map((char) => {
      return char === '-' ? 'rest' : 'hit'
    })

    return { type: 'Pattern', steps }
  }
)

const identifier_: p.Parser<Token, unknown, string> = p.token(
  (t) => t.name === 'identifier' ? t.text : undefined
)

const number_: p.Parser<Token, unknown, ast.NumberLiteral> = p.map(
  p.token((t) => t.name === 'number' ? t.text : undefined),
  (text) => ({ type: 'NumberLiteral', value: Number.parseFloat(text) })
)

const assignment_: p.Parser<Token, unknown, ast.Assignment> = p.abc(
  identifier_,
  literal('='),
  patternLiteral_,
  (key, _eq, value) => ({ type: 'Assignment', key, value })
)

const property_: p.Parser<Token, unknown, ast.Property> = p.abc(
  identifier_,
  literal(':'),
  number_,
  (key, _colon, value) => ({ type: 'Property', key, value })
)

const trackBlock_: p.Parser<Token, unknown, ast.Track> = p.right(
  p.token((t) => t.name === 'identifier' && t.text === 'track' ? true : undefined),
  p.middle(
    literal('{'),
    p.map(
      p.many(property_),
      (properties) => ({ type: 'Track', properties })
    ),
    literal('}')
  )
)

const program_: p.Parser<Token, unknown, ast.Program> = p.left(
  p.map(
    p.many(
      p.eitherOr(trackBlock_, assignment_)
    ),
    (statements) => {
      const patterns: Record<string, ast.Pattern> = {}
      let track: ast.Track | undefined

      for (const statement of statements) {
        switch (statement.type) {
          case 'Assignment':
            patterns[statement.key] = statement.value
            break
          case 'Track':
            track = statement
            break
          default:
            // @ts-expect-error - should be unreachable
            throw new Error(`Unexpected statement type: ${statement.type}`)
        }
      }

      return { type: 'Program', track, patterns }
    }
  ),
  p.end
)

export type ParseResult = {
  complete: false
  value: undefined
} | {
  complete: true
  value: ast.Program
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
