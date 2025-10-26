import type { DockLayout } from '@editor/layout.js'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'
import { useTabRendererContext } from '../panes/render-tab.js'
import { useLayoutNodeDispatch, type LayoutDispatch } from '../state/LayoutContext.js'
import { renderNode } from './render-node.js'

export const DockLayoutView: FunctionComponent<{
  className?: string
  layout: DockLayout
  dispatch: LayoutDispatch
}> = ({ className, layout, dispatch }) => {
  const mainDispatch = useLayoutNodeDispatch(dispatch, 'main')

  // Passed down to not call for every tab pane
  const tabRendererContext = useTabRendererContext()

  return (
    <div className={clsx('flex flex-col', className)}>
      {renderNode(layout.main, mainDispatch, tabRendererContext)}
    </div>
  )
}
