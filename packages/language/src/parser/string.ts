import { lex } from '../lexer/lexer.ts'

export function parseStringEscape (text: string): string | undefined {
  if (text.length !== 2 || !text.startsWith('\\')) {
    return undefined
  }

  const escaped = text[1]

  switch (escaped) {
    case '"':
      return '"'
    case '\\':
      return '\\'
    case 'n':
      return '\n'
    case 'r':
      return '\r'
    case 't':
      return '\t'
    case 'b':
      return '\b'
    case 'f':
      return '\f'
    case 'v':
      return '\v'
    default:
      return escaped
  }
}

export function parseStringLiteral (text: string): string | undefined {
  const lexed = lex(text)
  if (!lexed.complete) {
    return undefined
  }

  const tokens = lexed.value

  if (tokens.length < 2 || tokens.at(0)?.name !== '"' || tokens.at(-1)?.name !== '"') {
    return undefined
  }

  const parts = []

  for (let i = 1, limit = tokens.length - 1; i < limit; ++i) {
    const token = tokens[i]

    switch (token.name) {
      case 'stringContent':
        parts.push(token.text)
        break

      case 'stringEscape': {
        const unescaped = parseStringEscape(token.text)
        if (unescaped == null) {
          return undefined
        }

        parts.push(unescaped)
        break
      }

      default:
        return undefined
    }
  }

  return parts.join('')
}
