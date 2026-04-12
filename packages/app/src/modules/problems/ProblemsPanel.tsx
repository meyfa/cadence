import type { SourceRange } from '@ast'
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

        {problems.map(({ error, label }, index) => (
          <div key={index}>
            <span className='text-content-100'>
              {`${label}: `}
            </span>
            {error.message}
            {error instanceof RangeError && error.range != null && (
              <span className='text-content-100 text-sm'>
                {` (${stringifyRange(error.range)})`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function stringifyRange (range: SourceRange, maxPathLength = 32): string {
  const { filePath, line, column } = range

  if (filePath != null) {
    const fileName = filePath.split('/').at(-1) ?? filePath
    const truncatedFileName = fileName.length > maxPathLength
      ? fileName.slice(0, maxPathLength) + '…'
      : fileName
    return `${truncatedFileName}: Ln ${line}, Col ${column}`
  }

  return `Ln ${line}, Col ${column}`
}
