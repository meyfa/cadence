import { DockLayout, type LayoutNode } from '@editor/state/layout.js'
import { createContext, useCallback, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'
import { useSafeContext } from '../hooks/context.js'

const initialLayout: DockLayout = {
  main: undefined
}

function layoutReducer (state: DockLayout, action: SetStateAction<DockLayout>): DockLayout {
  return typeof action === 'function' ? action(state) : action
}

export type LayoutDispatch = Dispatch<SetStateAction<DockLayout>>
export type LayoutNodeDispatch = Dispatch<SetStateAction<LayoutNode>>

export function useLayoutNodeDispatch (parent: LayoutDispatch, child: keyof DockLayout): LayoutNodeDispatch {
  return useCallback((action: SetStateAction<LayoutNode>) => {
    parent((layout) => {
      if (layout[child] == null) {
        return layout
      }

      return {
        ...layout,
        [child]: typeof action === 'function' ? action(layout[child]) : action
      }
    })
  }, [parent, child])
}

export function useChildNodeDispatch (parent: LayoutNodeDispatch | undefined, childId: string): LayoutNodeDispatch | undefined {
  return useCallback((action: SetStateAction<LayoutNode>) => {
    parent?.((node) => {
      if (node.type !== 'split') {
        return node
      }

      return {
        ...node,
        children: node.children.map((child) => {
          if (child.id === childId) {
            return typeof action === 'function' ? action(child) : action
          }
          return child
        })
      }
    })
  }, [parent, childId])
}

export const LayoutContext = createContext<DockLayout | undefined>(undefined)
export const LayoutDispatchContext = createContext<Dispatch<SetStateAction<DockLayout>> | undefined>(undefined)

export const LayoutProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialLayout)

  return (
    <LayoutContext value={state}>
      <LayoutDispatchContext value={dispatch}>
        {children}
      </LayoutDispatchContext>
    </LayoutContext>
  )
}

export function useLayout (): [DockLayout, LayoutDispatch] {
  const state = useSafeContext(LayoutContext, 'LayoutContext')
  const dispatch = useSafeContext(LayoutDispatchContext, 'LayoutDispatchContext')

  return [state, dispatch]
}
