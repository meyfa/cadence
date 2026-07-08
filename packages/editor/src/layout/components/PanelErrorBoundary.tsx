import type { ComponentType, FunctionComponent, PropsWithChildren } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { ErrorBoundary } from 'react-error-boundary'

export const PanelErrorBoundary: FunctionComponent<PropsWithChildren<{
  FallbackComponent: ComponentType<FallbackProps>
}>> = ({ children, FallbackComponent }) => {
  return (
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      {children}
    </ErrorBoundary>
  )
}
