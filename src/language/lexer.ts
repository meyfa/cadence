import { createLexer, type Options, type Rules } from 'leac'

const rules: Rules = [
  { name: 'space', regex: /[ \t\n\r]+/, discard: true },

  { name: 'comment', regex: /#[^\n]*/, discard: true },

  { name: 'word', regex: /[a-zA-Z_][a-zA-Z_0-9]*/ },

  { name: 'number', regex: /[0-9]+(\.[0-9]+)?/ },
  { name: 'string', regex: /"([^"\\]|\\.)*"/ },
  { name: 'pattern', regex: /\[[ \t\n\rx-]*\]/ },

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

export const lex = createLexer(rules, state, options)
