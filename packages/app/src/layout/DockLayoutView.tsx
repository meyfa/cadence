import type { DockLayout } from '@editor/layout.js'
import type { FunctionComponent, ReactNode } from 'react'
import { renderNode } from './render-node.js'
import clsx from 'clsx'

export const DockLayoutView: FunctionComponent<{
  layout: DockLayout<ReactNode>
  className?: string
}> = ({ layout, className }) => {
  return (
    <div className={clsx('flex flex-col', className)}>
      {renderNode(layout.main)}
    </div>
  )
}
