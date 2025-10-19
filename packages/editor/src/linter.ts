import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import type { SourceLocation } from '@language/location.js'
import { parse } from '@language/parser/parser.js'
import { check } from '@language/compiler/compiler.js'
import { lex } from '@language/lexer/lexer.js'

function convertError (message: string, location: SourceLocation | undefined): Diagnostic {
  return {
    from: location?.offset ?? 0,
    to: (location?.offset ?? 0) + (location?.length ?? 0),
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
      return [convertError(tokens.error.message, tokens.error.location)]
    }

    const parsed = parse(tokens.value)
    if (!parsed.complete) {
      return [convertError(parsed.error.message, parsed.error.location)]
    }

    return check(parsed.value).map((err) => convertError(err.message, err.location))
  } catch (error) {
    if (error instanceof Error) {
      return [convertError(`Fatal error: ${error.message}`, undefined)]
    }

    throw error
  }
}
