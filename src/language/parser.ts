import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'
import * as ast from './ast.js'
import { combineLocations, locate, type Location } from './location.js'
import { truncateString, ParseError } from './error.js'

const ERROR_CONTEXT_LIMIT = 16
const ERROR_VALUE_LIMIT = 32

const keywords = ['track', 'section', 'for'] as const

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
        throw new ParseError(`Unexpected "${context}"; expected ${expected}`, locate(token))
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
    ? ast.make('Identifier', locate(t), { name: t.text })
    : undefined
})

const plainNumberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.token((t) => {
  return t.name === 'number'
    ? ast.make('NumberLiteral', locate(t), { value: Number.parseFloat(t.text) })
    : undefined
})

const numberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.ab(
  plainNumberLiteral_,
  p.option(
    p.satisfy((t) => t.name === 'word' && ast.units.includes(t.text as ast.Unit)),
    undefined
  ),
  (num, unitToken) => {
    const location = unitToken == null ? num.location : combineLocations(num, unitToken)
    const unit = unitToken == null ? undefined : unitToken.text as ast.Unit
    return ast.make('NumberLiteral', location, { value: num.value, unit })
  }
)

const stringLiteral_: p.Parser<Token, unknown, ast.StringLiteral> = p.token((t) => {
  return t.name === 'string'
    ? ast.make('StringLiteral', locate(t), { value: JSON.parse(t.text) })
    : undefined
})

function parsePattern (text: string): ast.Step[] {
  return text.slice(1, -1).replace(/\s/g, '').split('')
    .map((char): ast.Step => char === '-' ? 'rest' : 'hit')
}

const patternLiteral_: p.Parser<Token, unknown, ast.PatternLiteral> = p.token((t) => {
  return t.name === 'pattern'
    ? ast.make('PatternLiteral', locate(t), { value: parsePattern(t.text) })
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
  return ast.make('BinaryExpression', combineLocations(left, right), {
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
    (_l, v, _r) => ast.make(v.type, combineLocations(_l, _r), { ...v })
  ),
  value_
)

// primary ((*|/) primary)*
const multiplicativeExpression_: p.Parser<Token, unknown, ast.Expression> = p.leftAssoc2(
  primary_,
  p.map(
    p.satisfy((t) => t.name === '*' || t.name === '/'),
    (op) => makeBinaryExpression.bind(undefined, op)
  ),
  primary_
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
    return ast.make('Property', combineLocations(key, value), { key, value })
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
    return ast.make('Call', combineLocations(id, _rp), { callee: id, arguments: args })
  }
)

const assignment_: p.Parser<Token, unknown, ast.Assignment> = p.abc(
  identifier_,
  literal('='),
  expression_,
  (key, _eq, value) => {
    return ast.make('Assignment', combineLocations(key, value), { key, value })
  }
)

const routing_: p.Parser<Token, unknown, ast.Routing> = p.abc(
  identifier_,
  literal('<<'),
  expression_,
  (instrument, _arrow, pattern) => {
    return ast.make('Routing', combineLocations(instrument, pattern), { instrument, pattern })
  }
)

const sectionStatement_: p.Parser<Token, unknown, ast.SectionStatement> = p.abc(
  combine2(keyword('section'), identifier_),
  combine2(keyword('for'), expression_),
  combine3(
    literal('{'),
    p.many(routing_),
    expectLiteral('}')
  ),
  ([_section, name], [_for, length], [_lp, routings, _rp]) => {
    return ast.make('SectionStatement', combineLocations(_section, _rp), { name, length, routings })
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
    return ast.make('TrackStatement', combineLocations(_track, _rp), {
      properties: children.filter((c) => c.type === 'Property'),
      sections: children.filter((c) => c.type === 'SectionStatement')
    })
  }
)

const program_: p.Parser<Token, unknown, ast.Program> = p.ab(
  p.many(
    p.eitherOr(
      p.eitherOr(trackStatement_, assignment_),
      p.map(p.any, (token) => {
        const context = truncateString(token.text, ERROR_CONTEXT_LIMIT)
        throw new ParseError(`Unexpected statement beginning with "${context}"`, locate(token))
      })
    )
  ),
  p.end,
  (statements) => {
    const tracks = statements.filter((s) => s.type === 'TrackStatement')
    if (tracks.length > 1) {
      throw new ParseError('Duplicate track statement', tracks[1].location)
    }

    const assignments = statements.filter((s) => s.type === 'Assignment')

    const assignmentKeys = new Set<string>()
    for (const assignment of assignments) {
      if (assignmentKeys.has(assignment.key.name)) {
        const context = truncateString(assignment.key.name, ERROR_VALUE_LIMIT)
        throw new ParseError(`Duplicate definition of "${context}"`, assignment.key.location)
      }
      assignmentKeys.add(assignment.key.name)
    }

    return ast.make('Program', combineLocations(...statements), {
      track: tracks.at(0),
      assignments
    })
  }
)

// Public API

export type ParseResult = {
  readonly complete: false
  readonly error: ParseError
} | {
  readonly complete: true
  readonly value: ast.Program
}

export function parse (input: string): ParseResult {
  function getLineAndColumn (offset: number): Pick<Location, 'line' | 'column'> {
    const lines = input.slice(0, offset).split(/(?:\r\n|\r|\n)/)
    const line = lines.length
    const column = (lines.at(-1)?.length ?? 0) + 1
    return { line, column }
  }

  const lexerResult = lex(input)
  if (!lexerResult.complete) {
    const context = truncateString(input.slice(lexerResult.offset), ERROR_CONTEXT_LIMIT)

    return {
      complete: false,
      error: new ParseError(`Unexpected input "${context}"`, {
        offset: lexerResult.offset,
        length: 1,
        ...getLineAndColumn(lexerResult.offset)
      })
    }
  }

  let value: ast.Program | undefined
  try {
    value = p.tryParse(program_, lexerResult.tokens, {})
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
