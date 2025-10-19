import type { FunctionComponent } from 'react'
import clsx from 'clsx'
import type { LocationError } from '@language/error.js'
import type { EditorLocation } from '@editor/editor.js'

const MAX_ERRORS_DISPLAYED = 5

export const Footer: FunctionComponent<{
  errors: readonly LocationError[]
  editorLocation?: EditorLocation
}> = ({ errors, editorLocation }) => {
  return (
    <footer className='flex px-4 py-1 gap-2 text-sm text-gray-400 border-t border-t-gray-700 items-start'>
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
    </footer>
  )
}

function formatError (error: LocationError): string {
  if (error.location == null) {
    return error.message
  }

  return `${error.message} at line ${error.location.line}, column ${error.location.column}`
}
