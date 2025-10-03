import { createLexer } from 'leac'

export const lex = createLexer([
  { name: 'space', regex: /[ \t]+/, discard: true },
  { name: 'digit', regex: /[0-9]/ },
  { name: 'char', regex: /[a-zA-Z]/ },
  { name: '[' },
  { name: ']' },
  { name: '(' },
  { name: ')' },
  { name: '=' },
  { name: '.' },
  { name: ':' },
  { name: '*' },
  { name: '/' },
  { name: '+' },
  { name: '-' }
])
