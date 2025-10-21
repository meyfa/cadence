import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import type { SourceRange } from '@language/range.js'
import { parse } from '@language/parser/parser.js'
import { check } from '@language/compiler/compiler.js'
import { lex } from '@language/lexer/lexer.js'

function convertError (message: string, range: SourceRange | undefined): Diagnostic {
  return {
    from: range?.offset ?? 0,
    to: (range?.offset ?? 0) + (range?.length ?? 0),
    severity: 'error',
    message
  }
}

/**
 * A linter function for CodeMirror that uses the Cadence parser/compiler to check for
 * syntax errors and semantic errors.
 *
 * @param view The editor view to lint
 * @returns An array of diagnostics representing any parse errors found
 */
export function cadenceLinter (view: EditorView): Diagnostic[] {
  const input = view.state.doc.sliceString(0)

  try {
    const tokens = lex(input)
    if (!tokens.complete) {
      return [convertError(tokens.error.message, tokens.error.range)]
    }

    const parsed = parse(tokens.value)
    if (!parsed.complete) {
      return [convertError(parsed.error.message, parsed.error.range)]
    }

    return check(parsed.value).map((err) => convertError(err.message, err.range))
  } catch (error) {
    if (error instanceof Error) {
      return [convertError(`Fatal error: ${error.message}`, undefined)]
    }

    throw error
  }
}
