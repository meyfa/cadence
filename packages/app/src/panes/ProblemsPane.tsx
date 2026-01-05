import { RangeError } from '@language/error.js'
import clsx from 'clsx'
import { type FunctionComponent } from 'react'
import { useProblems, type Problem } from '../hooks/problems.js'

export const ProblemsPane: FunctionComponent = () => {
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
              {formatProblemSource(problem.source)}
            </span>
            {' '}
            {formatError(problem.error)}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatProblemSource (source: Problem['source']): string {
  switch (source) {
    case 'compiler':
      return 'Compiler:'
    case 'playback':
      return 'Playback:'
  }
}

function formatError (error: Error): string {
  const range = error instanceof RangeError ? error.range : undefined
  if (range == null) {
    return error.message
  }

  return `${error.message} at line ${range.line}, column ${range.column}`
}
