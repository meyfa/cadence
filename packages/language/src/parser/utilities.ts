import { getSourceRange } from '@meyfa/cadence-ast'
import type { Token } from 'leac'
import * as p from 'peberminta'
import { getErrorContext, ParseError } from './error.ts'
import type { Keyword } from './keywords.ts'

/**
 * A parser that expects the given parser to succeed, or else throws a `ParseError`
 * with a message including the given expected description. Both end-of-input and
 * non-matching tokens are considered errors.
 *
 * @param parser The parser to expect
 * @param expected A description of what was expected, for use in the error message
 * @returns A parser that produces the same value as the given parser, or throws a `ParseError`
 */
export function expect<TValue> (
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
        const context = getErrorContext(token)
        throw new ParseError(`Unexpected "${context}"; expected ${expected}`, getSourceRange(token))
      })
    )
  )
}

export function combine2<TToken, TOptions, TValueA, TValueB> (
  a: p.Parser<TToken, TOptions, TValueA>,
  b: p.Parser<TToken, TOptions, TValueB>
): p.Parser<TToken, TOptions, [TValueA, TValueB]> {
  return p.ab(a, b, (a, b) => [a, b])
}

export function combine3<TToken, TOptions, TValueA, TValueB, TValueC> (
  a: p.Parser<TToken, TOptions, TValueA>,
  b: p.Parser<TToken, TOptions, TValueB>,
  c: p.Parser<TToken, TOptions, TValueC>
): p.Parser<TToken, TOptions, [TValueA, TValueB, TValueC]> {
  return p.abc(a, b, c, (a, b, c) => [a, b, c])
}

export function literal (name: string): p.Parser<Token, unknown, Token> {
  return p.satisfy((t) => t.name === name)
}

export function keyword (keyword: Keyword): p.Parser<Token, unknown, Token> {
  return p.satisfy((t) => t.name === 'word' && t.text === keyword)
}

export function expectLiteral (name: string, printable = `"${name}"`): p.Parser<Token, unknown, Token> {
  return expect(literal(name), printable)
}
