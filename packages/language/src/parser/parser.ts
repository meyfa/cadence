import type { SourceRange } from '@meyfa/cadence-ast'
import { ast, combineSourceRanges, getSourceRange } from '@meyfa/cadence-ast'
import { isStepValue } from '@meyfa/cadence-core'
import type { Token } from 'leac'
import * as p from 'peberminta'
import { truncateString } from '../result/errors.ts'
import type { Result } from '../result/result.ts'
import type { Keyword } from './constants.ts'
import { isKeyword } from './constants.ts'
import { ParseError } from './error.ts'
import { parseStringEscape } from './string.ts'

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

const boolean_: p.Parser<Token, unknown, ast.Boolean> = p.token((t) => {
  return t.name === 'word' && (t.text === 'true' || t.text === 'false')
    ? ast.make('Boolean', getSourceRange(t), { value: t.text === 'true' })
    : undefined
})

const number_: p.Parser<Token, unknown, ast.Number> = p.token((t) => {
  return t.name === 'number'
    ? ast.make('Number', getSourceRange(t), { value: Number.parseFloat(t.text) })
    : undefined
})

const stringContent_: p.Parser<Token, unknown, string> = p.token((t) => {
  return t.name === 'stringContent' ? t.text : undefined
})

const stringEscape_: p.Parser<Token, unknown, string> = p.token((t) => {
  if (t.name !== 'stringEscape') {
    return undefined
  }

  return parseStringEscape(t.text)
})

const stringInterpolation_: p.Parser<Token, unknown, ast.Expression> = p.abc(
  literal('{'),
  p.recursive(() => expression_),
  expectLiteral('}'),
  (_l, expr, _r) => {
    return ast.make(expr.type, combineSourceRanges(_l, _r), { ...expr })
  }
)

const string_: p.Parser<Token, unknown, ast.String> = p.abc(
  literal('"'),
  p.many(
    p.eitherOr(
      p.eitherOr(
        stringContent_,
        stringEscape_
      ),
      stringInterpolation_
    )
  ),
  expectLiteral('"'),
  (_l, parts, _r) => {
    const mergedParts: Array<string | ast.Expression> = []

    for (const part of parts) {
      const last = mergedParts.at(-1)
      if (typeof part === 'string' && typeof last === 'string') {
        mergedParts[mergedParts.length - 1] = last + part
        continue
      }

      mergedParts.push(part)
    }

    return ast.make('String', combineSourceRanges(_l, _r), { parts: mergedParts })
  }
)

function splitStepsFromWordToken (text: string, tokenRange: SourceRange): readonly ast.Step[] {
  const steps: ast.Step[] = []
  let offset = 0

  while (offset < text.length) {
    const match = /^(?:x|[a-gA-G][#b]?(?:[0-9]|10))/.exec(text.slice(offset))

    const stepValue = match != null ? match[0] : text[offset]
    const stepRange: SourceRange = {
      offset: tokenRange.offset + offset,
      line: tokenRange.line,
      column: tokenRange.column + offset,
      length: stepValue.length,
      filePath: tokenRange.filePath
    }

    if (!isStepValue(stepValue)) {
      throw new ParseError(`Invalid step value in pattern: "${stepValue}"`, stepRange)
    }

    steps.push(ast.make('Step', stepRange, { value: stepValue, arguments: [] }))
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
        ast.make('Step', tokenRange, { value: t.name, arguments: [] })
      ]
    }
    if (t.name === 'word') {
      return splitStepsFromWordToken(t.text, tokenRange)
    }
    return undefined
  }),
  p.option(p.recursive(() => argumentList_), undefined),
  p.option(
    combine2(
      literal(':'),
      // Require parantheses around complex length expressions
      p.recursive(() => accessOrCall_)
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
          arguments: []
        })
      ]
    }

    const [, args, _rp] = callTail

    if (args.length === 0) {
      throw new ParseError('Step arguments cannot be empty', combineSourceRanges(_rp, _rp))
    }

    if (length == null) {
      return [
        ...steps.slice(0, -1),
        ast.make('Step', combineSourceRanges(lastStep, _rp), {
          value: lastStep.value,
          arguments: args
        })
      ]
    }

    return [
      ...steps.slice(0, -1),
      ast.make('Step', combineSourceRanges(lastStep, length), {
        value: lastStep.value,
        length,
        arguments: args
      })
    ]
  }
)

const patternInterpolation_: p.Parser<Token, unknown, ast.Expression> = p.abc(
  literal('{'),
  p.recursive(() => expression_),
  expectLiteral('}'),
  (_l, expr, _r) => {
    return ast.make(expr.type, combineSourceRanges(_l, _r), { ...expr })
  }
)

const patternChildren_: p.Parser<Token, unknown, ReadonlyArray<ast.Step | ast.Expression>> = p.map(
  p.many(
    p.eitherOr(
      steps_,
      p.eitherOr(
        p.eitherOr(
          p.recursive(() => serialPattern_),
          p.recursive(() => parallelPattern_)
        ),
        patternInterpolation_
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

const curveSegment_: p.Parser<Token, unknown, ast.CurveSegment> = p.ab(
  p.token((t) => t.name === 'word' ? t : undefined),
  combine2(
    p.option(
      combine3(
        literal('('),
        p.sepBy(
          p.recursive(() => optionalExpression_),
          literal(',')
        ),
        expectLiteral(')')
      ),
      undefined
    ),
    p.option(
      combine2(
        literal(':'),
        p.recursive(() => accessOrCall_)
      ),
      undefined
    )
  ),
  (curveTypeToken, [callTail, curveLength]) => {
    if (curveLength == null) {
      throw new ParseError(`Curve segment "${curveTypeToken.text}" is missing a length`, getSourceRange(curveTypeToken))
    }

    const curveType = curveTypeToken.text
    const args = callTail == null ? [] : callTail[1]
    const length = curveLength[1]

    return ast.make('CurveSegment', combineSourceRanges(curveTypeToken, length), { curveType, arguments: args, length })
  }
)

const curve_: p.Parser<Token, unknown, ast.Curve> = p.abc(
  literal('~['),
  p.many(
    p.eitherOr(curveSegment_, patternInterpolation_)
  ),
  expectLiteral(']'),
  (_l, children, _r) => {
    return ast.make('Curve', combineSourceRanges(_l, _r), { children })
  }
)

const namedType_: p.Parser<Token, unknown, ast.NamedType> = p.ab(
  // Do not use identifier_ as it excludes keywords, but keywords are valid type names (e.g. "effect" and "instrument")
  p.token((t) => {
    return t.name === 'word' ? ast.make('Identifier', getSourceRange(t), { name: t.text }) : undefined
  }),
  p.many(
    p.right(literal('.'), identifier_)
  ),
  (name, generics) => {
    return ast.make('NamedType', combineSourceRanges(name, ...generics), { name, generics })
  }
)

const functionType_: p.Parser<Token, unknown, ast.FunctionType> = p.abc(
  p.recursive(() => parameterList_),
  combine2(
    literal(':'),
    p.recursive(() => atomicType_)
  ),
  p.many(
    combine2(literal('!'), identifier_)
  ),
  ([_lp, parameters, _rp], [_colon, returnType], capabilitiesTokens) => {
    const lastToken = capabilitiesTokens.at(-1)?.at(-1) ?? returnType

    const capabilities = capabilitiesTokens.map(([, identifier]) => identifier)

    return ast.make('FunctionType', combineSourceRanges(_lp, lastToken), {
      parameters,
      returnType,
      capabilities
    })
  }
)

const recordTypeProperty_: p.Parser<Token, unknown, ast.RecordTypeProperty> = p.abc(
  identifier_,
  literal(':'),
  p.recursive(() => type_),
  (name, _colon, propertyType) => {
    return ast.make('RecordTypeProperty', combineSourceRanges(name, propertyType), { name, propertyType })
  }
)

const recordType_: p.Parser<Token, unknown, ast.RecordType> = p.abc(
  literal('{'),
  p.sepBy(
    recordTypeProperty_,
    literal(',')
  ),
  expectLiteral('}'),
  (_l, properties, _r) => {
    return ast.make('RecordType', combineSourceRanges(_l, _r), { properties })
  }
)

const atomicType_: p.Parser<Token, unknown, ast.Type> = p.choice<Token, unknown, ast.Type>(
  namedType_,
  functionType_,
  recordType_,
  p.abc(
    literal('('),
    p.recursive((): p.Parser<Token, unknown, ast.Type> => type_),
    literal(')'),
    (_l, type, _r) => {
      return ast.make(type.type, combineSourceRanges(_l, _r), { ...type })
    }
  )
)

const type_: p.Parser<Token, unknown, ast.Type> = p.leftAssoc2(
  atomicType_,
  p.map(
    literal('+'),
    () => (left: ast.Type, right: ast.Type) => {
      return ast.make('CombinedType', combineSourceRanges(left, right), {
        children: [left, right]
      })
    }
  ),
  atomicType_
)

const parameter_: p.Parser<Token, unknown, ast.Parameter> = p.abc(
  identifier_,
  literal(':'),
  type_,
  (name, _colon, parameterType) => {
    return ast.make('Parameter', combineSourceRanges(name, parameterType), { name, parameterType })
  }
)

type ParameterList = readonly [Token, readonly ast.Parameter[], Token]

const parameterList_: p.Parser<Token, unknown, ParameterList> = combine3(
  literal('('),
  p.sepBy(
    parameter_,
    literal(',')
  ),
  literal(')')
)

const function_: p.Parser<Token, unknown, ast.Function> = p.ab(
  parameterList_,
  combine3(
    literal('{'),
    p.recursive(() => p.many(statement_)),
    expectLiteral('}')
  ),
  ([_lp, parameters, _rp], [_lb, children, _rb]) => {
    return ast.make('Function', combineSourceRanges(_lp, _rb), { parameters, children })
  }
)

const recordValue_: p.Parser<Token, unknown, ast.RecordValue> = p.abc(
  literal('{'),
  p.recursive(() => p.many(statement_)),
  expectLiteral('}'),
  (_l, children, _r) => {
    return ast.make('RecordValue', combineSourceRanges(_l, _r), { children })
  }
)

const value_: p.Parser<Token, unknown, ast.Value> = p.choice<Token, unknown, ast.Value>(
  identifier_,
  boolean_,
  number_,
  string_,
  serialPattern_,
  curve_,
  function_,
  recordValue_,
  p.recursive(() => mixer_),
  p.recursive(() => bus_),
  p.recursive(() => track_),
  p.recursive(() => part_),
  p.recursive(() => instrument_),
  p.recursive(() => voice_)
)

const primary_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  value_,
  p.abc(
    literal('('),
    p.recursive(() => expression_),
    expectLiteral(')'),
    (_l, v, _r) => ast.make(v.type, combineSourceRanges(_l, _r), { ...v })
  )
)

// Parse a primary value, a property access, or a call; chained as needed.
const accessOrCall_: p.Parser<Token, unknown, ast.Expression> = p.ab(
  primary_,
  p.many(
    p.eitherOr(
      p.ab(
        literal('.'),
        expect(identifier_, 'property name'),
        (_dot, property) => property
      ),
      p.recursive(() => argumentList_)
    )
  ),
  (object, suffixes) => {
    let currentObject: ast.Expression = object

    const isArgumentList = (suffix: ast.Identifier | ArgumentList): suffix is ArgumentList => {
      return Array.isArray(suffix)
    }

    for (const suffix of suffixes) {
      if (isArgumentList(suffix)) {
        const [, args, _rp] = suffix
        currentObject = ast.make('Call', combineSourceRanges(currentObject, _rp), {
          callee: currentObject,
          arguments: args
        })
        continue
      }

      currentObject = ast.make('PropertyAccess', combineSourceRanges(currentObject, suffix), {
        object: currentObject,
        property: suffix
      })
    }

    return currentObject
  }
)

const unaryExpression_: p.Parser<Token, unknown, ast.Expression> = p.eitherOr(
  p.ab(
    p.eitherOr(literal('+'), literal('-')),
    p.recursive(() => unaryExpression_),
    (op, operand) => {
      // If it's a numeric literal, fold the unary operator directly
      if (operand.type === 'Number') {
        return ast.make('Number', combineSourceRanges(op, operand), {
          value: op.text === '+' ? operand.value : -operand.value
        })
      }

      return ast.make('UnaryExpression', combineSourceRanges(op, operand), {
        operator: op.text as ast.UnaryOperator,
        operand
      })
    }
  ),
  accessOrCall_
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
const optionalExpression_: p.Parser<Token, unknown, ast.Expression> = additiveExpression_
const expression_: p.Parser<Token, unknown, ast.Expression> = expect(
  optionalExpression_,
  'expression'
)

const argument_: p.Parser<Token, unknown, ast.Argument> = p.eitherOr(
  p.abc(
    identifier_,
    literal(':'),
    expression_,
    (name, _colon, value) => {
      return ast.make('Argument', combineSourceRanges(name, value), { name, value })
    }
  ),
  p.map(optionalExpression_, (value) => {
    return ast.make('Argument', getSourceRange(value), { value })
  })
)

type ArgumentList = readonly [Token, readonly ast.Argument[], Token]

const argumentList_: p.Parser<Token, unknown, ArgumentList> = combine3(
  literal('('),
  p.sepBy(
    argument_,
    literal(',')
  ),
  literal(')')
)

const import_: p.Parser<Token, unknown, ast.Import> = p.ab(
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
      return ast.make('Import', range, { library: libraryToken })
    }

    return ast.make('Import', range, { library: libraryToken, alias: (aliasToken as ast.Identifier).name })
  }
)

const plainAssignment_: p.Parser<Token, unknown, ast.Statement> = p.ab(
  p.option(literal('@'), undefined),
  combine3(
    identifier_,
    literal('='),
    expression_
  ),
  (expose, [key, _eq, value]) => {
    return ast.make('SimpleStatement', combineSourceRanges(expose ?? key, value), {
      emit: false,
      expose: expose != null,
      name: key,
      values: [value]
    })
  }
)

const plainEmission_: p.Parser<Token, unknown, ast.Statement> = p.abc(
  literal('&'),
  expression_,
  p.many(
    combine2(
      literal(','),
      expression_
    )
  ),
  (_amp, firstValue, rest) => {
    const restValues = rest.map(([, value]) => value)
    const lastValue = restValues.at(-1) ?? firstValue

    return ast.make('SimpleStatement', combineSourceRanges(_amp, lastValue), {
      emit: true,
      expose: false,
      values: [firstValue, ...restValues]
    })
  }
)

const emissionAssignment_: p.Parser<Token, unknown, ast.Statement> = p.abc(
  literal('&'),
  p.option(literal('@'), undefined),
  combine3(
    identifier_,
    literal('='),
    expression_
  ),
  (_amp, expose, [key, _eq, value]) => {
    return ast.make('SimpleStatement', combineSourceRanges(_amp, value), {
      emit: true,
      expose: expose != null,
      name: key,
      values: [value]
    })
  }
)

const simpleStatement_ = p.choice<Token, unknown, ast.Statement>(
  plainAssignment_,
  emissionAssignment_,
  plainEmission_
)

const conditionalBranch_: p.Parser<Token, unknown, ast.ConditionalBranch> = p.ab(
  optionalExpression_,
  combine3(
    literal('{'),
    p.recursive(() => p.many(statement_)),
    expectLiteral('}')
  ),
  (condition, [_lb, children, _rb]) => {
    return ast.make('ConditionalBranch', combineSourceRanges(condition, _rb), { condition, children })
  }
)

const ifStatement_: p.Parser<Token, unknown, ast.IfStatement> = p.abc(
  keyword('if'),
  p.sepBy1(conditionalBranch_, literal(',')),
  p.option(
    combine3(
      literal(','),
      keyword('else'),
      combine3(
        literal('{'),
        p.recursive(() => p.many(statement_)),
        expectLiteral('}')
      )
    ),
    undefined
  ),
  (_if, branches, elseClause) => {
    const elseBranch = elseClause?.[2][1]

    // The final token or AST node, such that the combined source range covers the entire statement.
    const lastItem = elseClause?.[2][2] ?? branches.at(-1) ?? _if

    return ast.make('IfStatement', combineSourceRanges(_if, lastItem), { branches, elseBranch })
  }
)

const statement_: p.Parser<Token, unknown, ast.Statement> = p.choice<Token, unknown, ast.Statement>(
  simpleStatement_,
  ifStatement_
)

interface BuilderFields {
  readonly arguments: readonly ast.Argument[]
  readonly children: readonly ast.Statement[]
}

function makeBuilder<TNode extends ast.ASTNode> (
  name: Keyword,
  create: (range: SourceRange, fields: BuilderFields) => TNode
): p.Parser<Token, unknown, TNode> {
  return p.abc(
    keyword(name),
    p.option(argumentList_, undefined),
    combine3(
      expectLiteral('{'),
      p.many(statement_),
      expectLiteral('}')
    ),
    (_keyword, callChain, [_lb, children, _rb]) => {
      const args = callChain == null ? [] : callChain[1]
      return create(combineSourceRanges(_keyword, _rb), { arguments: args, children })
    }
  )
}

const mixer_ = makeBuilder('mixer', (range, fields) => ast.make('Mixer', range, fields))
const bus_ = makeBuilder('bus', (range, fields) => ast.make('Bus', range, fields))
const track_ = makeBuilder('track', (range, fields) => ast.make('Track', range, fields))
const part_ = makeBuilder('part', (range, fields) => ast.make('Part', range, fields))
const instrument_ = makeBuilder('instrument', (range, fields) => ast.make('Instrument', range, fields))

const voice_: p.Parser<Token, unknown, ast.Voice> = p.abc(
  keyword('voice'),
  p.option(identifier_, undefined),
  combine3(
    literal('{'),
    p.many(statement_),
    expectLiteral('}')
  ),
  (_voice, note, [_lp, children, _rp]) => {
    return ast.make('Voice', combineSourceRanges(_voice, _rp), {
      children,
      bindings: {
        note
      }
    })
  }
)

const program_: p.Parser<Token, unknown, ast.Program> = p.abc(
  p.many(import_),
  p.many(
    p.eitherOr(
      statement_,
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
