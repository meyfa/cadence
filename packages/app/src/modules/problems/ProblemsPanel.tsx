import type { PanelProps } from '@editor'
import { useProblems } from '@editor'
import { RangeError } from '@language'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'

export const ProblemsPanel: FunctionComponent<PanelProps> = () => {
  const problems = useProblems()

  return (
    <div className='h-full overflow-auto p-4'>
      <div className={clsx('grow', problems.length > 0 ? 'text-content-300' : 'text-content-100')}>
        {problems.length === 0 && (
          <div className='text-content-100'>
            No problems found.
          </div>
        )}

        {problems.map((problem, index) => (
          <div key={index}>
            <span className='text-content-100'>
              {`${problem.label}:`}
            </span>
            {' '}
            {formatError(problem.error)}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatError (error: Error): string {
  const range = error instanceof RangeError ? error.range : undefined
  if (range == null) {
    return error.message
  }

  return `${error.message} at line ${range.line}, column ${range.column}`
}
