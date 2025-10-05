import { Token } from 'leac'
import * as p from 'peberminta'
import { lex } from './lexer.js'
import * as ast from './ast.js'

function literal (name: string): p.Parser<Token, unknown, true> {
  return p.token((t) => t.name === name ? true : undefined)
}

function keyword (keyword: string): p.Parser<Token, unknown, true> {
  return p.token((t) => t.name === 'word' && t.text === keyword ? true : undefined)
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

const binaryOperator_: p.Parser<Token, unknown, ast.BinaryOperator> = p.token((t) => {
  const operator = t.name as ast.BinaryOperator
  return ast.binaryOperators.includes(operator) ? operator : undefined
})

const value_: p.Parser<Token, unknown, ast.Value> = p.eitherOr(
  literal_,
  p.eitherOr(
    p.recursive(() => call_),
    identifier_
  )
)

const binaryExpression_: p.Parser<Token, unknown, ast.BinaryExpression> = p.leftAssoc2(
  p.abc(
    value_,
    binaryOperator_,
    value_,
    (left, operator, right) => ({ type: 'BinaryExpression', operator, left, right })
  ),
  p.map(
    binaryOperator_,
    (operator) => (left: ast.BinaryExpression, right: ast.Expression): ast.BinaryExpression => ({ type: 'BinaryExpression', operator, left, right })
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
  expression_,
  (key, _eq, value) => ({ type: 'Assignment', key, value })
)

const routing_: p.Parser<Token, unknown, ast.Routing> = p.abc(
  identifier_,
  literal('<<'),
  p.eitherOr(patternLiteral_, identifier_),
  (instrument, _arrow, pattern) => ({ type: 'Routing', instrument, pattern })
)

const sectionStatement_: p.Parser<Token, unknown, ast.SectionStatement> = p.abc(
  p.right(keyword('section'), identifier_),
  p.right(keyword('for'), numberLiteral_),
  p.middle(
    literal('{'),
    p.many(routing_),
    literal('}')
  ),
  (name, length, routings) => ({ type: 'SectionStatement', name, length, routings })
)

const trackStatement_: p.Parser<Token, unknown, ast.TrackStatement> = p.right(
  keyword('track'),
  p.middle(
    literal('{'),
    p.map(
      p.many(p.eitherOr(property_, sectionStatement_)),
      (children) => {
        const properties = children.filter((c) => c.type === 'Property')
        const sections = children.filter((c) => c.type === 'SectionStatement')
        return { type: 'TrackStatement', properties, sections }
      }
    ),
    literal('}')
  )
)

const program_: p.Parser<Token, unknown, ast.Program> = p.left(
  p.map(
    p.many(p.eitherOr(assignment_, trackStatement_)),
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

      return { type: 'Program', track, assignments }
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
