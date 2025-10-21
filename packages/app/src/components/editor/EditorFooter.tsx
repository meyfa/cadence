import type { EditorLocation } from '@editor/editor.js'
import type { RangeError } from '@language/error.js'
import type { FunctionComponent } from 'react'
import { Footer } from '../Footer.js'
import clsx from 'clsx'

const MAX_ERRORS_DISPLAYED = 5

export const EditorFooter: FunctionComponent<{
  errors: readonly RangeError[]
  editorLocation?: EditorLocation
}> = ({ errors, editorLocation }) => {
  return (
    <Footer>
      <div className={clsx('grow', errors.length > 0 && 'text-rose-400')}>
        {errors.length === 0 && 'No errors'}
        {errors.slice(0, MAX_ERRORS_DISPLAYED).map((error, index) => (
          <div key={index}>{formatError(error)}</div>
        ))}
        {errors.length > MAX_ERRORS_DISPLAYED && (
          <div>...and {errors.length - MAX_ERRORS_DISPLAYED} more errors</div>
        )}
      </div>

      {editorLocation != null && (
        <div>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </div>
      )}
    </Footer>
  )
}

function formatError (error: RangeError): string {
  if (error.range == null) {
    return error.message
  }

  return `${error.message} at line ${error.range.line}, column ${error.range.column}`
}
