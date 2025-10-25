import type { LayoutNode } from '@editor/layout.js'
import type { ReactNode } from 'react'
import { PaneNodeView } from './PaneNodeView.js'
import { SplitNodeView } from './SplitNodeView.js'

export function renderNode (node: LayoutNode<ReactNode>): ReactNode {
  if (node.type === 'pane') {
    return (
      <PaneNodeView node={node} />
    )
  }

  // node.type === 'split'
  return (
    <SplitNodeView node={node} />
  )
}
