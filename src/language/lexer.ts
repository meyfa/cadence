import { createLexer } from 'leac'

export const lex = createLexer([
  { name: 'space', regex: /[ \t\n\r]+/, discard: true },
  { name: 'identifier', regex: /[a-zA-Z_][a-zA-Z_0-9]*/ },
  { name: 'pattern', regex: /\[[ \t\n\rx-]*\]/ },
  { name: '=' }
])
