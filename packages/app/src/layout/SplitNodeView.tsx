import type { SplitDirection, SplitNode } from '@editor/layout.js'
import { Fragment, useState, type FunctionComponent, type ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { renderNode } from './render-node.js'
import clsx from 'clsx'

export const SplitNodeView: FunctionComponent<{
  node: SplitNode<ReactNode>
}> = ({ node }) => {
  const { direction, children, sizes } = node

  return (
    <PanelGroup direction={direction}>
      {children.map((child, index) => (
        <Fragment key={child.id}>
          <Panel id={child.id} defaultSize={sizes[index] * 100} minSize={10}>
            {renderNode(child)}
          </Panel>
          {index < children.length - 1 && (
            <ResizeHandle direction={direction} />
          )}
        </Fragment>
      ))}
    </PanelGroup>
  )
}

const ResizeHandle: FunctionComponent<{
  direction: SplitDirection
}> = ({ direction }) => {
  const [dragging, setDragging] = useState(false)

  return (
    <PanelResizeHandle className='relative z-10' onDragging={setDragging}>
      <div
        className={clsx(
          'absolute group inset-0 flex items-center',
          direction === 'horizontal' ? '-left-[5px] -right-[5px]' : '-top-[5px] -bottom-[5px]'
        )}
      >
        <div
          className={clsx(
            dragging ? 'bg-blue-400' : 'bg-transparent',
            'group-hover:bg-blue-400 transition-colors duration-200',
            direction === 'horizontal' ? 'w-1 h-full' : 'h-1 w-full'
          )}
        />
      </div>
    </PanelResizeHandle>
  )
}
