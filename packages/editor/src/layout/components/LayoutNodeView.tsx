import type { ComponentType, FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import type { LayoutNode, TabId } from '../types.js'
import type { DockLayoutStyles } from './DockLayoutView.js'
import type { LayoutDispatch } from './LayoutContext.js'
import { PaneNodeView } from './PaneNodeView.js'
import { SplitNodeView } from './SplitNodeView.js'
import type { TabTitleProps } from './TabTitle.js'

export interface LayoutNodeViewProps<TNode extends LayoutNode = LayoutNode> {
  readonly TabTitleComponent: ComponentType<TabTitleProps>
  readonly FallbackComponent: ComponentType<FallbackProps>
  readonly styles: DockLayoutStyles
  readonly node: TNode
  readonly focusedTabId?: TabId
  readonly currentDropTargetId?: string
  readonly dispatch?: LayoutDispatch
}

export const LayoutNodeView: FunctionComponent<LayoutNodeViewProps> = ({ node, ...props }) => {
  // Each component should have a key attribute to reset state when switching nodes

  switch (node.type) {
    case 'pane':
      return (<PaneNodeView key={node.id} {...props} node={node} />)
    case 'split':
      return (<SplitNodeView key={node.id} {...props} node={node} />)
  }
}
