import type { SourceRange } from '@ast'
import type { PanelProps, ProblemKind } from '@editor'
import { useProblems } from '@editor'
import { RangeError } from '@language'
import { Error, Warning } from '@mui/icons-material'
import clsx from 'clsx'
import type { FunctionComponent, ReactNode } from 'react'

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

        {problems.map(({ kind, label, message, error }, index) => (
          <div key={index}>
            <span className='text-content-100 mr-1'>
              {renderIconForProblemKind(kind)}
            </span>
            <span className='text-content-100'>
              {`${label}: `}
            </span>
            {message}
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

function renderIconForProblemKind (kind: ProblemKind): ReactNode {
  switch (kind) {
    case 'error':
      return <Error />
    case 'warning':
      return <Warning />
    default:
      kind satisfies never
  }
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
