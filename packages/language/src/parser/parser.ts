import { isStepValue } from '@core/program.js'
import { isKeyword, type Keyword } from '@language/constants.js'
import { Token } from 'leac'
import * as p from 'peberminta'
import { truncateString, type Result } from '../error.js'
import { combineSourceRanges, getSourceRange, type SourceRange } from '../range.js'
import * as ast from './ast.js'
import { ParseError } from './error.js'

const ERROR_CONTEXT_LIMIT = 16

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
        throw new ParseError(`Unexpected "${context}"; expected ${expected}`, getSourceRange(token))
      })
    )
  )
}

function expectLiteral (name: string, printable = `"${name}"`): p.Parser<Token, unknown, Token> {
  return expect(literal(name), printable)
}

// Grammar

const identifier_: p.Parser<Token, unknown, ast.Identifier> = p.token((t) => {
  return t.name === 'word' && !isKeyword(t.text)
    ? ast.make('Identifier', getSourceRange(t), { name: t.text })
    : undefined
})

const plainNumber_: p.Parser<Token, unknown, ast.Number> = p.token((t) => {
  return t.name === 'number'
    ? ast.make('Number', getSourceRange(t), { value: Number.parseFloat(t.text) })
    : undefined
})

const number_: p.Parser<Token, unknown, ast.Number> = p.ab(
  plainNumber_,
  p.option(
    p.satisfy((t) => t.name === 'word' && ast.units.includes(t.text as ast.Unit)),
    undefined
  ),
  (num, unitToken) => {
    const range = unitToken == null ? num.range : combineSourceRanges(num, unitToken)
    const unit = unitToken == null ? undefined : unitToken.text as ast.Unit
    return ast.make('Number', range, { value: num.value, unit })
  }
)

const string_: p.Parser<Token, unknown, ast.String> = p.token((t) => {
  return t.name === 'string'
    ? ast.make('String', getSourceRange(t), { value: JSON.parse(t.text) })
    : undefined
})

function splitStepsFromWordToken (text: string, tokenRange: SourceRange): ast.Step[] {
  const steps: ast.Step[] = []
  let offset = 0

  while (offset < text.length) {
    const match = /^(?:x|[a-gA-G][#b]?(?:[0-9]|10))/.exec(text.slice(offset))

    const stepValue = match != null ? match[0] : text[offset]
    const stepRange: SourceRange = {
      offset: tokenRange.offset + offset,
      line: tokenRange.line,
      column: tokenRange.column + offset,
      length: stepValue.length
    }

    if (!isStepValue(stepValue)) {
      throw new ParseError(`Invalid step value in pattern: "${stepValue}"`, stepRange)
    }

    steps.push(ast.make('Step', stepRange, { value: stepValue, parameters: [] }))
    offset += stepValue.length
  }

  return steps
}

// The lexer is unable to distinguish e.g. 'xx' (two step tokens) from 'xx' (one word token).
// Therefore, we have to split step tokens out of word tokens here.
const steps_: p.Parser<Token, unknown, readonly ast.Step[]> = p.abc(
  p.token((t) => {
    const tokenRange = getSourceRange(t)
    if (t.name === '-') {
      return [
        ast.make('Step', tokenRange, { value: t.name, parameters: [] })
      ]
    }
    if (t.name === 'word') {
      return splitStepsFromWordToken(t.text, tokenRange)
    }
    return undefined
  }),
  p.option(
    combine3(
      literal('('),
      p.sepBy(
        p.eitherOr(
          p.recursive(() => property_),
          p.recursive(() => expression_)
        ),
        literal(',')
      ),
      expectLiteral(')')
    ),
    undefined
  ),
  p.option(
    combine2(
      literal(':'),
      // Require parantheses around complex length expressions
      p.recursive(() => primary_)
    ),
    undefined
  ),
  (steps, callTail, stepLength) => {
    // By construction, the length only applies to the last step
    const lastStep = steps.at(-1)
    if (lastStep == null) {
      return steps
    }

    const length = stepLength?.[1]

    if (callTail == null) {
      if (length == null) {
        return steps
      }

      return [
        ...steps.slice(0, -1),
        ast.make('Step', combineSourceRanges(lastStep, length), {
          value: lastStep.value,
          length,
          parameters: []
        })
      ]
    }

    const [, parameters, _rp] = callTail

    if (length == null) {
      return [
        ...steps.slice(0, -1),
        ast.make('Step', combineSourceRanges(lastStep, _rp), {
          value: lastStep.value,
          parameters
        })
      ]
    }

    return [
      ...steps.slice(0, -1),
      ast.make('Step', combineSourceRanges(lastStep, length), {
        value: lastStep.value,
        length,
        parameters
      })
    ]
  }
)

const patternChildren_: p.Parser<Token, unknown, ReadonlyArray<ast.Step | ast.Pattern>> = p.map(
  p.many(
    p.eitherOr(
      steps_,
      p.eitherOr(
        p.recursive(() => serialPattern_),
        p.recursive(() => parallelPattern_)
      )
    )
  ),
  (children) => children.flat()
)

const serialPattern_: p.Parser<Token, unknown, ast.Pattern> = p.abc(
  literal('['),
  patternChildren_,
  expectLiteral(']'),
  (_l, children, _r) => {
    return ast.make('Pattern', combineSourceRanges(_l, _r), { mode: 'serial', children })
  }
)

const parallelPattern_: p.Parser<Token, unknown, ast.Pattern> = p.abc(
  literal('<'),
  p.filter(patternChildren_, (children) => children.length > 0),
  expectLiteral('>'),
  (_l, children, _r) => {
    return ast.make('Pattern', combineSourceRanges(_l, _r), { mode: 'parallel', children })
  }
)

const value_: p.Parser<Token, unknown, ast.Value> = p.eitherOr(
  p.eitherOr(
    p.eitherOr(
      number_,
      string_
    ),
    serialPattern_
  ),
  p.recursive(() => identifierOrCall_)
)

const primary_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  p.abc(
    literal('('),
    p.recursive(() => expression_),
    expectLiteral(')'),
    (_l, v, _r) => ast.make(v.type, combineSourceRanges(_l, _r), { ...v })
  ),
  value_
)

const unaryExpression_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  p.ab(
    p.eitherOr(literal('+'), literal('-')),
    p.recursive(() => unaryExpression_),
    (op, expr) => {
      // If it's a numeric literal, fold the unary operator directly
      if (expr.type === 'Number') {
        return ast.make('Number', combineSourceRanges(op, expr), {
          value: op.text === '+' ? expr.value : -expr.value,
          unit: expr.unit
        })
      }

      return ast.make('UnaryExpression', combineSourceRanges(op, expr), {
        operator: op.text as ast.UnaryOperator,
        argument: expr
      })
    }
  ),
  primary_
)

function makeBinaryExpression (operator: Token, left: ast.Expression, right: ast.Expression): ast.BinaryExpression {
  return ast.make('BinaryExpression', combineSourceRanges(left, right), {
    operator: operator.text as ast.BinaryOperator,
    left,
    right
  })
}

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
    return ast.make('Property', combineSourceRanges(key, value), { key, value })
  }
)

// Parse an identifier, or an identifier followed by call arguments, without backtracking
const identifierOrCall_: p.Parser<Token, unknown, ast.Identifier | ast.Call> = p.ab(
  identifier_,
  p.option(
    combine3(
      literal('('),
      p.sepBy(p.eitherOr(property_, expression_), literal(',')),
      expectLiteral(')')
    ),
    undefined
  ),
  (id, callTail) => {
    if (callTail == null) {
      return id
    }

    const [, args, _rp] = callTail
    return ast.make('Call', combineSourceRanges(id, _rp), { callee: id, arguments: args })
  }
)

const useStatement_: p.Parser<Token, unknown, ast.UseStatement> = p.ab(
  combine2(
    keyword('use'),
    expect(string_, 'module name')
  ),
  combine2(
    expect(keyword('as'), 'keyword "as"'),
    expect(
      p.eitherOr(identifier_, literal('*')),
      'alias identifier or "*"'
    )
  ),
  ([_use, libraryToken], [_as, aliasToken]) => {
    const range = combineSourceRanges(_use, aliasToken)
    if (aliasToken.name === '*') {
      return ast.make('UseStatement', range, { library: libraryToken })
    }

    return ast.make('UseStatement', range, { library: libraryToken, alias: (aliasToken as ast.Identifier).name })
  }
)

const assignment_: p.Parser<Token, unknown, ast.Assignment> = p.abc(
  identifier_,
  literal('='),
  expression_,
  (key, _eq, value) => {
    return ast.make('Assignment', combineSourceRanges(key, value), { key, value })
  }
)

const routingChain_: p.Parser<Token, unknown, readonly ast.Routing[]> = p.abc(
  identifier_,
  literal('<<'),
  p.eitherOr(p.recursive(() => routingChain_), expression_),
  (left, _arrow, right) => {
    // type guard
    const isRouting = (node: ast.Expression | readonly ast.Routing[]): node is readonly ast.Routing[] => {
      return Array.isArray(node)
    }

    if (isRouting(right)) {
      // Given a statement like `a << b << c`, right will be the routing chain `b << c`.
      // We need to create a routing from `a` to `b`, prepended to the rest of the chain.
      return [
        ast.make('Routing', combineSourceRanges(left, right[0]), {
          destination: left,
          source: right[0].destination
        }),
        ...right
      ]
    }

    return [
      ast.make('Routing', combineSourceRanges(left, right), {
        destination: left,
        source: right
      })
    ]
  }
)

const sectionStatement_: p.Parser<Token, unknown, ast.SectionStatement> = p.abc(
  combine2(keyword('section'), identifier_),
  combine2(keyword('for'), expression_),
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, routingChain_)),
    expectLiteral('}')
  ),
  ([_section, name], [_for, length], [_lp, children, _rp]) => {
    const flatChildren = children.flatMap((c) => Array.isArray(c) ? c : [c])

    return ast.make('SectionStatement', combineSourceRanges(_section, _rp), {
      name,
      length,
      properties: flatChildren.filter((c) => c.type === 'Property'),
      routings: flatChildren.filter((c) => c.type === 'Routing')
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
    return ast.make('TrackStatement', combineSourceRanges(_track, _rp), {
      properties: children.filter((c) => c.type === 'Property'),
      sections: children.filter((c) => c.type === 'SectionStatement')
    })
  }
)

const effectStatement_: p.Parser<Token, unknown, ast.EffectStatement> = p.ab(
  keyword('effect'),
  expression_,
  (_effect, expression) => {
    return ast.make('EffectStatement', combineSourceRanges(_effect, expression), {
      expression
    })
  }
)

const busStatement_: p.Parser<Token, unknown, ast.BusStatement> = p.abc(
  keyword('bus'),
  identifier_,
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, effectStatement_)),
    expectLiteral('}')
  ),
  (_bus, name, [_lp, children, _rp]) => {
    return ast.make('BusStatement', combineSourceRanges(_bus, _rp), {
      name,
      properties: children.filter((c) => c.type === 'Property'),
      effects: children.filter((c) => c.type === 'EffectStatement')
    })
  }
)

const mixerStatement_: p.Parser<Token, unknown, ast.MixerStatement> = p.ab(
  keyword('mixer'),
  combine3(
    literal('{'),
    p.many(p.eitherOr(property_, p.eitherOr(routingChain_, busStatement_))),
    expectLiteral('}')
  ),
  (_mixer, [_lp, children, _rp]) => {
    const flatChildren = children.flatMap((c) => Array.isArray(c) ? c : [c])

    return ast.make('MixerStatement', combineSourceRanges(_mixer, _rp), {
      properties: flatChildren.filter((c) => c.type === 'Property'),
      routings: flatChildren.filter((c) => c.type === 'Routing'),
      buses: flatChildren.filter((c) => c.type === 'BusStatement')
    })
  }
)

const program_: p.Parser<Token, unknown, ast.Program> = p.abc(
  p.many(useStatement_),
  p.many(
    p.eitherOr(
      p.eitherOr(assignment_, p.eitherOr(trackStatement_, mixerStatement_)),
      p.map(p.any, (token) => {
        const context = truncateString(token.text, ERROR_CONTEXT_LIMIT)
        throw new ParseError(`Unexpected statement beginning with "${context}"`, getSourceRange(token))
      })
    )
  ),
  p.end,
  (imports, children) => {
    return ast.make('Program', combineSourceRanges(...children), {
      imports,
      children
    })
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
