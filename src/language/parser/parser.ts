import { Token } from 'leac'
import * as p from 'peberminta'
import * as ast from './ast.js'
import { combineSourceLocations, getSourceLocation } from '../location.js'
import { truncateString, type Result } from '../error.js'
import { ParseError } from './error.js'
import type { Step } from '../../core/program.js'

const ERROR_CONTEXT_LIMIT = 16

const keywords = ['track', 'section', 'for', 'mixer', 'bus'] as const

type Keyword = (typeof keywords)[number]

// Parser helpers

function combine2<TToken, TOptions, TValueA, TValueB> (
  a: p.Parser<TToken, TOptions, TValueA>,
  b: p.Parser<TToken, TOptions, TValueB>
): p.Parser<TToken, TOptions, [TValueA, TValueB]> {
  return p.ab(a, b, (a, b) => [a, b])
}

function combine3<TToken, TOptions, TValueA, TValueB, TValueC> (
  a: p.Parser<TToken, TOptions, TValueA>,
  b: p.Parser<TToken, TOptions, TValueB>,
  c: p.Parser<TToken, TOptions, TValueC>
): p.Parser<TToken, TOptions, [TValueA, TValueB, TValueC]> {
  return p.abc(a, b, c, (a, b, c) => [a, b, c])
}

function literal (name: string): p.Parser<Token, unknown, Token> {
  return p.satisfy((t) => t.name === name)
}

function keyword (keyword: Keyword): p.Parser<Token, unknown, Token> {
  return p.satisfy((t) => t.name === 'word' && t.text === keyword)
}

// Error helpers

/**
 * A parser that expects the given parser to succeed, or else throws a `ParseError`
 * with a message including the given expected description. Both end-of-input and
 * non-matching tokens are considered errors.
 *
 * @param parser The parser to expect
 * @param expected A description of what was expected, for use in the error message
 * @returns A parser that produces the same value as the given parser, or throws a `ParseError`
 */
function expect<TValue> (
  parser: p.Parser<Token, unknown, TValue>,
  expected: string
): p.Parser<Token, unknown, TValue> {
  return p.eitherOr(
    parser,
    p.eitherOr(
      p.map(p.end, () => {
        throw new ParseError(`Unexpected end of input; expected ${expected}`)
      }),
      p.map(p.any, (token) => {
        const context = truncateString(token.text, ERROR_CONTEXT_LIMIT)
        throw new ParseError(`Unexpected "${context}"; expected ${expected}`, getSourceLocation(token))
      })
    )
  )
}

function expectLiteral (name: string, printable = `"${name}"`): p.Parser<Token, unknown, Token> {
  return expect(literal(name), printable)
}

// Grammar

const identifier_: p.Parser<Token, unknown, ast.Identifier> = p.token((t) => {
  return t.name === 'word' && !keywords.includes(t.text as Keyword)
    ? ast.make('Identifier', getSourceLocation(t), { name: t.text })
    : undefined
})

const plainNumberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.token((t) => {
  return t.name === 'number'
    ? ast.make('NumberLiteral', getSourceLocation(t), { value: Number.parseFloat(t.text) })
    : undefined
})

const numberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.ab(
  plainNumberLiteral_,
  p.option(
    p.satisfy((t) => t.name === 'word' && ast.units.includes(t.text as ast.Unit)),
    undefined
  ),
  (num, unitToken) => {
    const location = unitToken == null ? num.location : combineSourceLocations(num, unitToken)
    const unit = unitToken == null ? undefined : unitToken.text as ast.Unit
    return ast.make('NumberLiteral', location, { value: num.value, unit })
  }
)

const stringLiteral_: p.Parser<Token, unknown, ast.StringLiteral> = p.token((t) => {
  return t.name === 'string'
    ? ast.make('StringLiteral', getSourceLocation(t), { value: JSON.parse(t.text) })
    : undefined
})

function parsePattern (text: string): Step[] {
  const steps: Step[] = []

  // Start after the opening '[' and stop before the closing ']'
  for (let pos = 1, n = text.length - 1; pos < n;) {
    const char = text[pos]

    if (/\s/.test(char)) {
      pos++
      continue
    }

    if (char === '-' || char === 'x') {
      steps.push(char)
      pos++
      continue
    }

    const noteMatch = /^([a-gA-G])([#b]?)(10|[0-9])/.exec(text.slice(pos))
    if (noteMatch != null) {
      const [match, note, accidental, octave] = noteMatch
      steps.push((note.toUpperCase() + accidental + octave) as Step)
      pos += match.length
      continue
    }

    // Invalid character
    break
  }

  return steps
}

const patternLiteral_: p.Parser<Token, unknown, ast.PatternLiteral> = p.token((t) => {
  return t.name === 'pattern'
    ? ast.make('PatternLiteral', getSourceLocation(t), { value: parsePattern(t.text) })
    : undefined
})

const literal_: p.Parser<Token, unknown, ast.Literal> = p.eitherOr(
  stringLiteral_,
  p.eitherOr(
    numberLiteral_,
    patternLiteral_
  )
)

const value_: p.Parser<Token, unknown, ast.Value> = p.eitherOr(
  literal_,
  p.recursive(() => identifierOrCall_)
)

function makeBinaryExpression (operator: Token, left: ast.Expression, right: ast.Expression): ast.BinaryExpression {
  return ast.make('BinaryExpression', combineSourceLocations(left, right), {
    operator: operator.text as ast.BinaryOperator,
    left,
    right
  })
}

const primary_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  p.abc(
    literal('('),
    p.recursive(() => expression_),
    expectLiteral(')'),
    (_l, v, _r) => ast.make(v.type, combineSourceLocations(_l, _r), { ...v })
  ),
  value_
)

const unaryExpression_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  p.ab(
    literal('-'),
    p.recursive(() => unaryExpression_),
    (op, expr) => {
      // If it's a numeric literal, fold to a negative literal
      if (expr.type === 'NumberLiteral') {
        return ast.make('NumberLiteral', combineSourceLocations(op, expr), {
          value: -expr.value,
          unit: expr.unit
        })
      }

      // Otherwise, desugar to (0 - expr) to reuse existing binary handling
      const zero = ast.make('NumberLiteral', getSourceLocation(op), { value: 0 })
      return makeBinaryExpression(op, zero, expr)
    }
  ),
  primary_
)

// unary ((*|/) unary)*
const multiplicativeExpression_: p.Parser<Token, unknown, ast.Expression> = p.leftAssoc2(
  unaryExpression_,
  p.map(
    p.satisfy((t) => t.name === '*' || t.name === '/'),
    (op) => makeBinaryExpression.bind(undefined, op)
  ),
  unaryExpression_
)

// multiplicative ((+|-) multiplicative)*
const additiveExpression_: p.Parser<Token, unknown, ast.Expression> = p.leftAssoc2(
  multiplicativeExpression_,
  p.map(
    p.satisfy((t) => t.name === '+' || t.name === '-'),
    (op) => makeBinaryExpression.bind(undefined, op)
  ),
  multiplicativeExpression_
)

// The top-level expression parser
const expression_: p.Parser<Token, unknown, ast.Expression> = expect(
  additiveExpression_,
  'expression'
)

const property_: p.Parser<Token, unknown, ast.Property> = p.abc(
  identifier_,
  literal(':'),
  expression_,
  (key, _colon, value) => {
    return ast.make('Property', combineSourceLocations(key, value), { key, value })
  }
)

// Parse an identifier, or an identifier followed by call arguments, without backtracking
const identifierOrCall_: p.Parser<Token, unknown, ast.Identifier | ast.Call> = p.ab(
  identifier_,
  p.option(
    combine3(
      literal('('),
      p.sepBy(property_, literal(',')),
      expectLiteral(')')
    ),
    undefined
  ),
  (id, callTail) => {
    if (callTail == null) {
      return id
    }

    const [, args, _rp] = callTail
    return ast.make('Call', combineSourceLocations(id, _rp), { callee: id, arguments: args })
  }
)

const assignment_: p.Parser<Token, unknown, ast.Assignment> = p.abc(
  identifier_,
  literal('='),
  expression_,
  (key, _eq, value) => {
    return ast.make('Assignment', combineSourceLocations(key, value), { key, value })
  }
)

const routing_: p.Parser<Token, unknown, ast.Routing> = p.abc(
  identifier_,
  literal('<<'),
  expression_,
  (destination, _arrow, source) => {
    return ast.make('Routing', combineSourceLocations(destination, source), { destination, source })
  }
)

const sectionStatement_: p.Parser<Token, unknown, ast.SectionStatement> = p.abc(
  combine2(keyword('section'), identifier_),
  combine2(keyword('for'), expression_),
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, routing_)),
    expectLiteral('}')
  ),
  ([_section, name], [_for, length], [_lp, children, _rp]) => {
    return ast.make('SectionStatement', combineSourceLocations(_section, _rp), {
      name,
      length,
      properties: children.filter((c) => c.type === 'Property'),
      routings: children.filter((c) => c.type === 'Routing')
    })
  }
)

const trackStatement_: p.Parser<Token, unknown, ast.TrackStatement> = p.ab(
  keyword('track'),
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, sectionStatement_)),
    expectLiteral('}')
  ),
  (_track, [_lp, children, _rp]) => {
    return ast.make('TrackStatement', combineSourceLocations(_track, _rp), {
      properties: children.filter((c) => c.type === 'Property'),
      sections: children.filter((c) => c.type === 'SectionStatement')
    })
  }
)

const busStatement_: p.Parser<Token, unknown, ast.BusStatement> = p.abc(
  keyword('bus'),
  identifier_,
  combine3(
    literal('{'),
    p.many(property_),
    expectLiteral('}')
  ),
  (_bus, name, [_lp, properties, _rp]) => {
    return ast.make('BusStatement', combineSourceLocations(_bus, _rp), {
      name,
      properties
    })
  }
)

const mixerStatement_: p.Parser<Token, unknown, ast.MixerStatement> = p.ab(
  keyword('mixer'),
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, p.eitherOr(routing_, busStatement_))),
    expectLiteral('}')
  ),
  (_mixer, [_lp, children, _rp]) => {
    return ast.make('MixerStatement', combineSourceLocations(_mixer, _rp), {
      properties: children.filter((c) => c.type === 'Property'),
      routings: children.filter((c) => c.type === 'Routing'),
      buses: children.filter((c) => c.type === 'BusStatement')
    })
  }
)

const program_: p.Parser<Token, unknown, ast.Program> = p.ab(
  p.many(
    p.eitherOr(
      p.eitherOr(assignment_, p.eitherOr(trackStatement_, mixerStatement_)),
      p.map(p.any, (token) => {
        const context = truncateString(token.text, ERROR_CONTEXT_LIMIT)
        throw new ParseError(`Unexpected statement beginning with "${context}"`, getSourceLocation(token))
      })
    )
  ),
  p.end,
  (children) => {
    return ast.make('Program', combineSourceLocations(...children), { children })
  }
)

// Public API

export type ParseResult = Result<ast.Program, ParseError>

export function parse (tokens: Token[]): ParseResult {
  let value: ast.Program | undefined
  try {
    value = p.tryParse(program_, tokens, {})
  } catch (error) {
    if (error instanceof ParseError) {
      return { complete: false, error }
    }

    throw error
  }

  if (value == null) {
    return {
      complete: false,
      error: new ParseError('Parsing failed for unknown reason')
    }
  }

  return { complete: true, value }
}
