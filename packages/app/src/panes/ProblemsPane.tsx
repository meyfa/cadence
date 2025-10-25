import type { RangeError } from '@language/error.js'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'

export const ProblemsPane: FunctionComponent<{
  errors: readonly RangeError[]
}> = ({ errors }) => {
  return (
    <div className='h-full overflow-auto p-4'>
      <div className={clsx('grow', errors.length > 0 ? 'text-content-300' : 'text-content-100')}>
        {errors.length === 0 && 'No problems detected'}
        {errors.map((error, index) => (
          <div key={index}>{formatError(error)}</div>
        ))}
      </div>
    </div>
  )
}

function formatError (error: RangeError): string {
  if (error.range == null) {
    return error.message
  }

  return `${error.message} at line ${error.range.line}, column ${error.range.column}`
}
