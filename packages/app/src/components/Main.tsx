import { type FunctionComponent } from 'react'
import { DockLayoutView } from '../layout/DockLayoutView.js'
import { useLayout } from '../state/LayoutContext.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'

export const Main: FunctionComponent = () => {
  const [layout, layoutDispatch] = useLayout()

  return (
    <PanelErrorBoundary>
      <DockLayoutView
        layout={layout}
        dispatch={layoutDispatch}
        className='flex-1 min-h-0 min-w-0'
      />
    </PanelErrorBoundary>
  )
}
