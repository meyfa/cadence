import type { ComponentType, FunctionComponent, PropsWithChildren } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'

export const PanelErrorBoundary: FunctionComponent<PropsWithChildren<{
  FallbackComponent: ComponentType<FallbackProps>
}>> = ({ children, FallbackComponent }) => {
  return (
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      {children}
    </ErrorBoundary>
  )
}
