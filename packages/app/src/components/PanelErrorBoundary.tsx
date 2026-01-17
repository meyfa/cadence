import type { FunctionComponent, PropsWithChildren } from 'react'
import { Button } from './Button.js'
import { ErrorBoundary } from 'react-error-boundary'

export const PanelErrorBoundary: FunctionComponent<PropsWithChildren> = ({ children }) => {
  return (
    <ErrorBoundary FallbackComponent={PanelErrorFallback}>
      {children}
    </ErrorBoundary>
  )
}

const PanelErrorFallback: FunctionComponent<{
  error: unknown
  resetErrorBoundary: () => void
}> = ({ error, resetErrorBoundary }) => {
  const value = error instanceof Error ? error : new Error(String(error))

  return (
    <div className='p-4 h-full'>
      <div>
        Something went wrong while rendering this panel:
      </div>
      <div className='w-fit border-l-4 border-l-error-surface px-3 py-1 my-4'>
        {value.name}
        {': '}
        {value.message}
      </div>
      <div>
        <Button onClick={() => resetErrorBoundary()}>
          Retry
        </Button>
      </div>
    </div>
  )
}
