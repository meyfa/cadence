import type { FunctionComponent } from 'react'
import clsx from 'clsx'
import type { CompileError, ParseError } from '../../language/error.js'

export interface EditorLocation {
  readonly line: number
  readonly column: number
}

export const Footer: FunctionComponent<{
  errors: ReadonlyArray<ParseError | CompileError>
  editorLocation?: EditorLocation
}> = ({ errors, editorLocation }) => {
  return (
    <footer className='flex p-2 gap-2 text-sm text-gray-400 items-start'>
      <div className={clsx('grow', errors.length > 0 && 'text-rose-400')}>
        {errors.length === 0 && 'No errors'}
        {errors.map((error, index) => (
          <div key={index}>{formatError(error)}</div>
        ))}
      </div>

      {editorLocation != null && (
        <div>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </div>
      )}
    </footer>
  )
}

function formatError (error: ParseError | CompileError): string {
  if (error.location == null) {
    return error.message
  }

  return `${error.message} at line ${error.location.line}, column ${error.location.column}`
}
