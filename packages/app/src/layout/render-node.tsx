import type { LayoutNode } from '@editor/state/layout.js'
import type { ReactNode } from 'react'
import type { TabRendererContext } from '../panes/render-tab.js'
import type { LayoutNodeDispatch } from '../state/LayoutContext.js'
import { PaneNodeView } from './PaneNodeView.js'
import { SplitNodeView } from './SplitNodeView.js'

export function renderNode (
  node: LayoutNode,
  dispatch: LayoutNodeDispatch,
  tabRendererContext: TabRendererContext
): ReactNode {
  if (node.type === 'pane') {
    return (
      <PaneNodeView node={node} dispatch={dispatch} tabRendererContext={tabRendererContext} />
    )
  }

  // node.type === 'split'
  return (
    <SplitNodeView node={node} dispatch={dispatch} tabRendererContext={tabRendererContext} />
  )
}
