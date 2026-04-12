import { numeric } from '@utility'
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FunctionComponent } from 'react'
import { Group, Panel, Separator, useGroupRef, type Layout } from 'react-resizable-panels'
import { useChangeOrigin } from '../../hooks/change-origin.js'
import { transformNode } from '../algorithms/mutate.js'
import type { SplitNode, SplitOrientation } from '../types.js'
import type { DockLayoutStyles } from './DockLayoutView.js'
import { LayoutNodeView, type LayoutNodeViewProps } from './LayoutNodeView.js'

// The interval during which layout changes are considered part of the same change stack.
const CHANGE_STACK_WINDOW = numeric('s', 0.05)

type LayoutChangeOrigin = 'library' | 'self'

export const SplitNodeView: FunctionComponent<LayoutNodeViewProps<SplitNode>> = ({ node, ...props }) => {
  const { dispatch, styles } = props
  const { id: nodeId, orientation, children, sizes } = node

  const groupRef = useGroupRef()

  // Keep track of what started the chain of events to avoid feedback loops
  const pushChangeOrigin = useChangeOrigin<LayoutChangeOrigin>(CHANGE_STACK_WINDOW)

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
    if (layoutsEqual(newLayout, layout)) {
      return
    }

    if (pushChangeOrigin('library')) {
      dispatch?.((layout) => transformNode(layout, nodeId, (node) => {
        if (node.type !== 'split') {
          return node
        }
        return { ...node, sizes: node.children.map(({ id }) => (newLayout[id] ?? 100) / 100) }
      }))
      return
    }

    // Reassert desired layout
    applyLayoutProp()
  }, [pushChangeOrigin, dispatch, applyLayoutProp, layout, nodeId])

  useLayoutEffect(() => {
    pushChangeOrigin('self')
    applyLayoutProp()
  }, [pushChangeOrigin, applyLayoutProp])

  return (
    <Group
      id={nodeId}
      groupRef={groupRef}
      orientation={orientation}
      defaultLayout={layout}
      onLayoutChange={onLayoutChange}
      style={{ width: '100%', height: '100%' }}
    >
      {children.map((child, index) => (
        <Fragment key={child.id}>
          <SplitNodeChildView {...props} node={child} />
          {index < children.length - 1 && (
            <ResizeHandle orientation={orientation} styles={styles} />
          )}
        </Fragment>
      ))}
    </Group>
  )
}

const SplitNodeChildView: FunctionComponent<LayoutNodeViewProps> = (props) => {
  const { node } = props

  return (
    <Panel id={node.id} minSize='5rem'>
      <LayoutNodeView {...props} />
    </Panel>
  )
}

const splitStyles = {
  separator: {
    horizontal: { width: '1px' },
    vertical: { height: '1px' }
  } satisfies Record<SplitOrientation, CSSProperties>,

  handle: {
    horizontal: { inset: 0, left: '-5px', right: '-5px' },
    vertical: { inset: 0, top: '-5px', bottom: '-5px' }
  } satisfies Record<SplitOrientation, CSSProperties>,

  indicator: {
    horizontal: { width: '4px', height: '100%', left: '3px' },
    vertical: { width: '100%', height: '4px', top: '3px' }
  } satisfies Record<SplitOrientation, CSSProperties>
}

const ResizeHandle: FunctionComponent<{
  orientation: SplitOrientation
  styles: DockLayoutStyles
}> = ({ orientation, styles }) => {
  const separatorRef = useRef<HTMLDivElement | null>(null)
  const [isHighlighted, setIsHighlighted] = useState(false)

  // The Separator component does not expose its state other than through data attributes,
  // so we need to observe those to apply our own styles.
  useLayoutEffect(() => {
    const root = separatorRef.current
    if (root == null) {
      return
    }

    const updateHighlight = () => {
      const state = root.dataset.separator ?? ''
      setIsHighlighted(state === 'hover' || state === 'active' || state === 'focus')
    }

    const observer = new MutationObserver(updateHighlight)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-separator']
    })

    updateHighlight()

    return () => observer.disconnect()
  }, [])

  return (
    <Separator
      elementRef={separatorRef}
      style={{
        position: 'relative',
        zIndex: 10,
        outline: 'none',
        backgroundColor: styles.tabListBorderColor,
        ...splitStyles.separator[orientation]
      }}
    >
      <div style={{ position: 'absolute', ...splitStyles.handle[orientation] }}>
        <div
          style={{
            position: 'relative',
            transition: 'background-color 200ms',
            backgroundColor: isHighlighted ? styles.highlightColor : undefined,
            ...splitStyles.indicator[orientation]
          }}
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
