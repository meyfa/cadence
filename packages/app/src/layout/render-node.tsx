import type { LayoutNode } from '@editor/state/layout.js'
import type { ReactNode } from 'react'
import type { TabRendererContext } from '../panes/render-tab.js'
import type { LayoutNodeDispatch } from '../state/LayoutContext.js'
import { PaneNodeView } from './PaneNodeView.js'
import { SplitNodeView } from './SplitNodeView.js'

export function renderNode (
  node: LayoutNode | undefined,
  tabRendererContext: TabRendererContext,
  dispatch?: LayoutNodeDispatch
): ReactNode {
  if (node == null) {
    return (
      <div className='w-full h-full flex items-center justify-center text-surface-300 text-4xl font-semibold select-none overflow-clip'>
        Cadence
      </div>
    )
  }

  // Each component should have a key attribute to reset state when switching nodes

  if (node.type === 'pane') {
    return (
      <PaneNodeView key={node.id} node={node} tabRendererContext={tabRendererContext} dispatch={dispatch} />
    )
  }

  // node.type === 'split'
  return (
    <SplitNodeView key={node.id} node={node} tabRendererContext={tabRendererContext} dispatch={dispatch} />
  )
}
