import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'
import * as ast from './ast.js'

function literal (name: string): p.Parser<Token, unknown, true> {
  return p.token((t) => t.name === name ? true : undefined)
}

const identifier_: p.Parser<Token, unknown, ast.Identifier> = p.map(
  p.token((t) => t.name === 'word' ? t.text : undefined),
  (name) => ({ type: 'Identifier', name })
)

const unit_: p.Parser<Token, unknown, ast.Unit> = p.token((t) => {
  if (t.name === 'word' && ast.units.includes(t.text as ast.Unit)) {
    return t.text as ast.Unit
  }
  return undefined
})

const numberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.choice(
  p.ab(
    p.token((t) => t.name === 'number' ? t.text : undefined),
    unit_,
    (text, unit) => ({ type: 'NumberLiteral', value: Number.parseFloat(text), unit })
  ),
  p.map(
    p.token((t) => t.name === 'number' ? t.text : undefined),
    (text) => ({ type: 'NumberLiteral', value: Number.parseFloat(text) })
  )
)

const stringLiteral_: p.Parser<Token, unknown, ast.StringLiteral> = p.map(
  p.token((t) => t.name === 'string' ? t.text : undefined),
  (text) => {
    // Remove surrounding quotes and unescape characters
    const unescaped = JSON.parse(text)
    return { type: 'StringLiteral', value: unescaped }
  }
)

const patternLiteral_: p.Parser<Token, unknown, ast.PatternLiteral> = p.map(
  p.token((t) => t.name === 'pattern' ? t.text : undefined),
  (text) => {
    const value = text.slice(1, -1).replace(/\s/g, '').split('').map((char) => {
      return char === '-' ? 'rest' : 'hit'
    })

    return { type: 'PatternLiteral', value }
  }
)

const literal_: p.Parser<Token, unknown, ast.Literal> = p.eitherOr(
  stringLiteral_,
  p.eitherOr(
    numberLiteral_,
    patternLiteral_
  )
)

const property_: p.Parser<Token, unknown, ast.Property> = p.abc(
  identifier_,
  literal(':'),
  literal_,
  (key, _colon, value) => ({ type: 'Property', key, value })
)

const call_: p.Parser<Token, unknown, ast.Call> = p.ab(
  identifier_,
  p.middle(
    literal('('),
    p.sepBy(property_, literal(',')),
    literal(')')
  ),
  (callee, args) => ({ type: 'Call', callee, arguments: args })
)

const assignment_: p.Parser<Token, unknown, ast.Assignment> = p.abc(
  identifier_,
  literal('='),
  p.eitherOr(patternLiteral_, call_),
  (key, _eq, value) => ({ type: 'Assignment', key, value })
)

const routing_: p.Parser<Token, unknown, ast.Routing> = p.abc(
  identifier_,
  literal('<<'),
  p.eitherOr(patternLiteral_, identifier_),
  (instrument, _arrow, pattern) => ({ type: 'Routing', instrument, pattern })
)

const trackBlock_: p.Parser<Token, unknown, ast.Track> = p.right(
  p.token((t) => t.name === 'word' && t.text === 'track' ? true : undefined),
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
      p.eitherOr(trackBlock_, p.eitherOr(assignment_, routing_))
    ),
    (statements) => {
      let track: ast.Track | undefined
      const assignments: ast.Assignment[] = []
      const routings: ast.Routing[] = []

      for (const statement of statements) {
        switch (statement.type) {
          case 'Track':
            track = statement
            break
          case 'Assignment':
            assignments.push(statement)
            break
          case 'Routing':
            routings.push(statement)
            break
          default:
            // @ts-expect-error - should be unreachable
            throw new Error(`Unexpected statement type: ${statement.type}`)
        }
      }

      return { type: 'Program', track, assignments, routings }
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
