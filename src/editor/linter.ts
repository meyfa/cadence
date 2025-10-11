import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import type { Location } from '../language/location.js'
import { parse } from '../language/parser.js'
import { check } from '../language/compiler/compiler.js'

function convertError (message: string, location: Location | undefined): Diagnostic {
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
    const parsed = parse(input)
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
