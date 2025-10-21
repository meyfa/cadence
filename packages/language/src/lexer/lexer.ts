import { createLexer, type Options, type Rules, type Token } from 'leac'
import { LexError } from './error.js'
import { truncateString, type Result } from '../error.js'
import type { SourceRange } from '../range.js'

const ERROR_CONTEXT_LIMIT = 16

const rules: Rules = [
  { name: 'space', regex: /[ \t\n\r]+/, discard: true },

  { name: 'comment', regex: /\/\/[^\n]*/, discard: true },

  { name: 'word', regex: /[a-zA-Z_][a-zA-Z_0-9]*/ },

  { name: 'number', regex: /[0-9]+(\.[0-9]+)?/ },
  { name: 'string', regex: /"([^"\\]|\\.)*"/ },
  { name: 'pattern', regex: /\[(?:[ \t\n\r]|[-x]|[a-gA-G][#b]?(?:[0-9]|10))*\]/ },

  { name: '{' },
  { name: '}' },
  { name: '(' },
  { name: ')' },
  { name: ',' },

  { name: '=' },
  { name: ':' },
  { name: '<<' },

  { name: '+' },
  { name: '-' },
  { name: '*' },
  { name: '/' }
]

const state = undefined

const options: Options = {
  lineNumbers: true
}

const lexer = createLexer(rules, state, options)

export type LexResult = Result<Token[], LexError>

export function lex (input: string): LexResult {
  function getLineAndColumn (offset: number): Pick<SourceRange, 'line' | 'column'> {
    const lines = input.slice(0, offset).split(/(?:\r\n|\r|\n)/)
    const line = lines.length
    const column = (lines.at(-1)?.length ?? 0) + 1
    return { line, column }
  }

  const lexerResult = lexer(input)
  if (!lexerResult.complete) {
    const context = truncateString(input.slice(lexerResult.offset), ERROR_CONTEXT_LIMIT)

    return {
      complete: false,
      error: new LexError(`Unexpected input "${context}"`, {
        offset: lexerResult.offset,
        length: 1,
        ...getLineAndColumn(lexerResult.offset)
      })
    }
  }

  return { complete: true, value: lexerResult.tokens }
}
