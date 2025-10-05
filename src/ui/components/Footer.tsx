import type { FunctionComponent } from 'react'
import type { ParseResult } from '../../language/parser.js'
import clsx from 'clsx'

export const Footer: FunctionComponent<{
  parseResult: ParseResult
  editorLocation?: {
    line: number
    column: number
  }
}> = ({ parseResult, editorLocation }) => {
  return (
    <footer
      className={clsx(
        'flex p-2 gap-2 text-sm text-gray-400',
        !parseResult.complete && 'bg-red-500/20 text-red-500'
      )}
    >
      <div className='grow'>
        {parseResult.complete
          ? 'No errors'
          : 'Parsing failed'}
      </div>

      {editorLocation != null && (
        <div>
          Ln {editorLocation.line}, Col {editorLocation.column}
        </div>
      )}
    </footer>
  )
}
