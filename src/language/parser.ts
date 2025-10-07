import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'
import * as ast from './ast.js'
import { combineLocations, locate } from './location.js'

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

function keyword (keyword: string): p.Parser<Token, unknown, Token> {
  return p.satisfy((t) => t.name === 'word' && t.text === keyword)
}

const identifier_: p.Parser<Token, unknown, ast.Identifier> = p.token((t) => {
  return t.name === 'word'
    ? {
        type: 'Identifier',
        location: locate(t),
        name: t.text
      }
    : undefined
})

const unit_: p.Parser<Token, unknown, Token> = p.satisfy((t) => {
  return t.name === 'word' && ast.units.includes(t.text as ast.Unit)
})

const plainNumberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.token((t) => {
  return t.name === 'number'
    ? {
        type: 'NumberLiteral',
        location: locate(t),
        value: Number.parseFloat(t.text)
      }
    : undefined
})

const numberLiteral_: p.Parser<Token, unknown, ast.NumberLiteral> = p.choice(
  p.ab(
    plainNumberLiteral_,
    unit_,
    (number, unitToken) => ({
      type: 'NumberLiteral',
      location: combineLocations(number, unitToken),
      value: number.value,
      unit: unitToken.text as ast.Unit
    })
  ),
  plainNumberLiteral_
)

const stringLiteral_: p.Parser<Token, unknown, ast.StringLiteral> = p.token((t) => {
  return t.name === 'string'
    ? {
        type: 'StringLiteral',
        location: locate(t),
        value: JSON.parse(t.text)
      }
    : undefined
})

const patternLiteral_: p.Parser<Token, unknown, ast.PatternLiteral> = p.token((t) => {
  return t.name === 'pattern'
    ? {
        type: 'PatternLiteral',
        location: locate(t),
        value: t.text.slice(1, -1).replace(/\s/g, '').split('')
          .map((char): ast.Step => char === '-' ? 'rest' : 'hit')
      }
    : undefined
})

const literal_: p.Parser<Token, unknown, ast.Literal> = p.eitherOr(
  stringLiteral_,
  p.eitherOr(
    numberLiteral_,
    patternLiteral_
  )
)

const binaryOperator_: p.Parser<Token, unknown, Token> = p.satisfy((t) => {
  return ast.binaryOperators.includes(t.name as ast.BinaryOperator)
})

const value_: p.Parser<Token, unknown, ast.Value> = p.eitherOr(
  literal_,
  p.eitherOr(
    p.recursive(() => call_),
    identifier_
  )
)

const makeBinaryExpression = (
  left: ast.Expression,
  operator: Token,
  right: ast.Expression
): ast.BinaryExpression => ({
  type: 'BinaryExpression',
  location: combineLocations(left, right),
  operator: operator.text as ast.BinaryOperator,
  left,
  right
})

const binaryExpression_: p.Parser<Token, unknown, ast.BinaryExpression> = p.leftAssoc2(
  p.abc(value_, binaryOperator_, value_, makeBinaryExpression),
  p.map(
    binaryOperator_,
    (operator) => (left, right: ast.Expression) => makeBinaryExpression(left, operator, right)
  ),
  p.recursive(() => expression_)
)

const expression_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  binaryExpression_,
  value_
)

const property_: p.Parser<Token, unknown, ast.Property> = p.abc(
  identifier_,
  literal(':'),
  expression_,
  (key, _colon, value) => ({
    type: 'Property',
    location: combineLocations(key, value),
    key,
    value
  })
)

const call_: p.Parser<Token, unknown, ast.Call> = p.ab(
  identifier_,
  combine3(
    literal('('),
    p.sepBy(property_, literal(',')),
    literal(')')
  ),
  (callee, [_lp, args, _rp]) => ({
    type: 'Call',
    location: combineLocations(callee, _rp),
    callee,
    arguments: args
  })
)

const assignment_: p.Parser<Token, unknown, ast.Assignment> = p.abc(
  identifier_,
  literal('='),
  expression_,
  (key, _eq, value) => ({
    type: 'Assignment',
    location: combineLocations(key, value),
    key,
    value
  })
)

const routing_: p.Parser<Token, unknown, ast.Routing> = p.abc(
  identifier_,
  literal('<<'),
  p.eitherOr(patternLiteral_, identifier_),
  (instrument, _arrow, pattern) => ({
    type: 'Routing',
    location: combineLocations(instrument, pattern),
    instrument,
    pattern
  })
)

const sectionStatement_: p.Parser<Token, unknown, ast.SectionStatement> = p.abc(
  combine2(keyword('section'), identifier_),
  combine2(keyword('for'), expression_),
  combine3(
    literal('{'),
    p.many(routing_),
    literal('}')
  ),
  ([_section, name], [_for, length], [_lp, routings, _rp]) => ({
    type: 'SectionStatement',
    location: combineLocations(_section, _rp),
    name: name,
    length: length,
    routings: routings
  })
)

const trackStatement_: p.Parser<Token, unknown, ast.TrackStatement> = p.ab(
  keyword('track'),
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, sectionStatement_)),
    literal('}')
  ),
  (_track, [_lp, children, _rp]) => ({
    type: 'TrackStatement',
    location: combineLocations(_track, _rp),
    properties: children.filter((c) => c.type === 'Property'),
    sections: children.filter((c) => c.type === 'SectionStatement')
  })
)

const program_: p.Parser<Token, unknown, ast.Program> = p.ab(
  p.many(p.eitherOr(assignment_, trackStatement_)),
  p.end,
  (statements) => {
    let track: ast.TrackStatement | undefined
    const assignments: ast.Assignment[] = []

    for (const statement of statements) {
      switch (statement.type) {
        case 'TrackStatement':
          track = statement
          break
        case 'Assignment':
          assignments.push(statement)
          break
        default:
          // @ts-expect-error - should be unreachable
          throw new Error(`Unexpected statement type: ${statement.type}`)
      }
    }

    return {
      type: 'Program',
      location: combineLocations(...statements),
      track,
      assignments
    }
  }
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
