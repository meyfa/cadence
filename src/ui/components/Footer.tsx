import type { FunctionComponent } from 'react'
import type { ParseError, ParseResult } from '../../language/parser.js'
import clsx from 'clsx'

export const Footer: FunctionComponent<{
  parseResult: ParseResult
  editorLocation?: {
    line: number
    column: number
  }
}> = ({ parseResult, editorLocation }) => {
  return (
    <footer className='flex p-2 gap-2 text-sm text-gray-400'>
      <div className={clsx('grow', !parseResult.complete && 'text-rose-400')}>
        {parseResult.complete ? 'No errors' : formatParseError(parseResult.error)}
      </div>

      {editorLocation != null && (
        <div>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </div>
      )}
    </footer>
  )
}

function formatParseError (error: ParseError): string {
  if (error.location == null) {
    return error.message
  }

  return `${error.message} at line ${error.location.line}, column ${error.location.column}`
}
