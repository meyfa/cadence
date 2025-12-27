import type { LayoutNode, SplitNode, SplitOrientation } from '@editor/state/layout.js'
import clsx from 'clsx'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type FunctionComponent } from 'react'
import { Group, Panel, Separator, useGroupRef, type Layout } from 'react-resizable-panels'
import type { TabRendererContext } from '../panes/render-tab.js'
import { useChildNodeDispatch, type LayoutNodeDispatch } from '../state/LayoutContext.js'
import { renderNode } from './render-node.js'

// The interval during which layout changes are considered part of the same change stack.
const CHANGE_STACK_WINDOW_MS = 50

type LayoutChangeOrigin = 'library' | 'self'

export const SplitNodeView: FunctionComponent<{
  node: SplitNode
  tabRendererContext: TabRendererContext
  dispatch?: LayoutNodeDispatch
}> = ({ node, tabRendererContext, dispatch }) => {
  const { orientation, children, sizes } = node

  const groupRef = useGroupRef()

  // Keep track of what started the chain of events to avoid feedback loops
  const pushChangeOrigin = useChangeOrigin<LayoutChangeOrigin>(CHANGE_STACK_WINDOW_MS)

  const layout = useMemo(() => {
    return Object.fromEntries(children.map((child, index) => [child.id, (sizes.at(index) ?? 1) * 100]))
  }, [children, sizes])

  const applyLayoutProp = useCallback(() => {
    try {
      groupRef.current?.setLayout(layout)
    } catch {
      // Ignore errors from setting layout during unmount
    }
  }, [layout])

  const onLayoutChange = useCallback((newLayout: Layout) => {
    if (pushChangeOrigin('library')) {
      dispatch?.((node) => {
        if (node.type !== 'split') {
          return node
        }
        return { ...node, sizes: node.children.map(({ id }) => (newLayout[id] ?? 100) / 100) }
      })
      return
    }

    if (!layoutsEqual(newLayout, layout)) {
      // Reassert desired layout
      applyLayoutProp()
    }
  }, [pushChangeOrigin, dispatch, applyLayoutProp, layout])

  useLayoutEffect(() => {
    if (pushChangeOrigin('self')) {
      applyLayoutProp()
    }
  }, [pushChangeOrigin, applyLayoutProp])

  return (
    <Group
      id={node.id}
      groupRef={groupRef}
      orientation={orientation}
      defaultLayout={layout}
      onLayoutChange={onLayoutChange}
      className='w-full h-full'
    >
      {children.map((child, index) => (
        <Fragment key={child.id}>
          <SplitNodeChildView
            parentDispatch={dispatch}
            child={child}
            tabRendererContext={tabRendererContext}
          />
          {index < children.length - 1 && (<ResizeHandle orientation={orientation} />)}
        </Fragment>
      ))}
    </Group>
  )
}

const SplitNodeChildView: FunctionComponent<{
  child: LayoutNode
  tabRendererContext: TabRendererContext
  parentDispatch?: LayoutNodeDispatch
}> = ({ child, tabRendererContext, parentDispatch }) => {
  const childDispatch = useChildNodeDispatch(parentDispatch, child.id)

  return (
    <Panel id={child.id} minSize='5rem'>
      {renderNode(child, tabRendererContext, childDispatch)}
    </Panel>
  )
}

const ResizeHandle: FunctionComponent<{
  orientation: SplitOrientation
}> = ({ orientation }) => {
  return (
    <Separator
      className={clsx(
        'group relative z-10 bg-frame-200 outline-none',
        orientation === 'horizontal' ? 'w-px' : 'h-px'
      )}
    >
      <div
        className={clsx(
          'absolute inset-0 flex items-center justify-center',
          orientation === 'horizontal' ? '-left-[5px] -right-[5px]' : '-top-[5px] -bottom-[5px]'
        )}
      >
        <div
          className={clsx(
            'transition-colors duration-200',
            orientation === 'horizontal' ? 'w-1 h-full' : 'h-1 w-full',
            'group-data-[separator=hover]:bg-accent-200 group-data-[separator=hover]:shadow-md',
            'group-focus-visible:bg-accent-200 group-focus-visible:shadow-md',
            'group-data-[separator=active]:bg-accent-200'
          )}
        />
      </div>
    </Separator>
  )
}

function layoutsEqual (a: Partial<Layout>, b: Partial<Layout>, epsilon = 0.5): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  return keysA.length === keysB.length && keysA.every((key) => {
    if (a[key] == null || b[key] == null) {
      return a[key] === b[key]
    }

    return Math.abs(a[key] - b[key]) <= epsilon
  })
}

type PushOrigin<T> = (origin: T) => boolean

/**
 * Returns a function to track the origin of changes within a time window.
 * If the window is new or was started by the same origin, the function returns true.
 * Otherwise, it returns false.
 * Any call to the function resets the time window.
 */
function useChangeOrigin<T extends string> (windowMs: number): PushOrigin<T> {
  const originRef = useRef<T | undefined>(undefined)
  const pendingResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Clear any pending timeout on unmount to avoid stray timers
  useEffect(() => {
    return () => {
      if (pendingResetRef.current != null) {
        clearTimeout(pendingResetRef.current)
        pendingResetRef.current = undefined
      }
    }
  }, [])

  return useCallback((origin: T) => {
    const scheduleReset = () => {
      if (pendingResetRef.current != null) {
        clearTimeout(pendingResetRef.current)
      }

      pendingResetRef.current = setTimeout(() => {
        originRef.current = undefined
        pendingResetRef.current = undefined
      }, windowMs)
    }

    scheduleReset()

    if (originRef.current != null && originRef.current !== origin) {
      return false
    }

    originRef.current = origin
    return true
  }, [windowMs])
}
