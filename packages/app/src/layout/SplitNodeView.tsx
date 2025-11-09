import type { LayoutNode, SplitDirection, SplitNode } from '@editor/state/layout.js'
import clsx from 'clsx'
import { Fragment, useCallback, useEffect, useRef, useState, type FunctionComponent } from 'react'
import { ImperativePanelHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { TabRendererContext } from '../panes/render-tab.js'
import { useChildNodeDispatch, type LayoutNodeDispatch } from '../state/LayoutContext.js'
import { renderNode } from './render-node.js'

export const SplitNodeView: FunctionComponent<{
  node: SplitNode
  tabRendererContext: TabRendererContext
  dispatch?: LayoutNodeDispatch
}> = ({ node, tabRendererContext, dispatch }) => {
  const { direction, children, sizes } = node

  const onLayout = useCallback((newSizes: number[]) => {
    dispatch?.((node) => {
      if (node.type !== 'split') {
        return node
      }

      return { ...node, sizes: newSizes.map((size) => size / 100) }
    })
  }, [dispatch])

  return (
    <PanelGroup direction={direction} onLayout={onLayout}>
      {children.map((child, index) => (
        <Fragment key={child.id}>
          <SplitNodeChildView
            parentDispatch={dispatch}
            child={child}
            size={sizes[index]}
            order={index}
            tabRendererContext={tabRendererContext}
          />
          {index < children.length - 1 && (<ResizeHandle direction={direction} />)}
        </Fragment>
      ))}
    </PanelGroup>
  )
}

const SplitNodeChildView: FunctionComponent<{
  child: LayoutNode
  size: number
  order: number
  tabRendererContext: TabRendererContext
  parentDispatch?: LayoutNodeDispatch
}> = ({ child, size, order, tabRendererContext, parentDispatch }) => {
  const childDispatch = useChildNodeDispatch(parentDispatch, child.id)

  const panelRef = useRef<ImperativePanelHandle>(null)

  // Ensure the panel resizes when the size prop changes
  useEffect(() => {
    panelRef.current?.resize(size * 100)
  }, [size])

  return (
    <Panel ref={panelRef} id={child.id} order={order} defaultSize={size * 100} minSize={10}>
      {renderNode(child, tabRendererContext, childDispatch)}
    </Panel>
  )
}

const ResizeHandle: FunctionComponent<{
  direction: SplitDirection
}> = ({ direction }) => {
  const [dragging, setDragging] = useState(false)

  return (
    <PanelResizeHandle
      className={clsx('relative z-10 bg-frame-200', direction === 'horizontal' ? 'w-px' : 'h-px')}
      onDragging={setDragging}
    >
      <div
        className={clsx(
          'absolute group inset-0 flex items-center justify-center',
          direction === 'horizontal' ? '-left-[5px] -right-[5px]' : '-top-[5px] -bottom-[5px]'
        )}
      >
        <div
          className={clsx(
            dragging ? 'bg-accent-400' : 'bg-transparent',
            'group-hover:bg-accent-400 group-hover:shadow-md transition-colors duration-200',
            direction === 'horizontal' ? 'w-1 h-full' : 'h-1 w-full'
          )}
        />
      </div>
    </PanelResizeHandle>
  )
}
