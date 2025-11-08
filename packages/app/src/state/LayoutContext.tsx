import { DockLayout, type LayoutNode, type LayoutNodeId, type TabId } from '@editor/state/layout.js'
import { createContext, useCallback, useContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'
import { TabTypes } from '../panes/render-tab.js'

const initialLayout: DockLayout = {
  main: {
    id: 'root' as LayoutNodeId,
    type: 'pane',
    tabs: [
      { id: 'editor' as TabId, component: { type: TabTypes.Editor } }
    ],
    activeTabId: 'editor' as TabId
  }
}

function layoutReducer (state: DockLayout, action: SetStateAction<DockLayout>): DockLayout {
  return typeof action === 'function' ? action(state) : action
}

export type LayoutDispatch = Dispatch<SetStateAction<DockLayout>>
export type LayoutNodeDispatch = Dispatch<SetStateAction<LayoutNode>>

export function useLayoutNodeDispatch (parent: LayoutDispatch, child: keyof DockLayout): LayoutNodeDispatch {
  return useCallback((action: SetStateAction<LayoutNode>) => {
    parent((layout) => ({
      ...layout,
      [child]: typeof action === 'function' ? action(layout[child]) : action
    }))
  }, [parent, child])
}

export function useChildNodeDispatch (parent: LayoutNodeDispatch, childId: string): LayoutNodeDispatch {
  return useCallback((action: SetStateAction<LayoutNode>) => {
    parent((node) => {
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

export const LayoutContext = createContext<DockLayout>(initialLayout)
export const LayoutDispatchContext = createContext<Dispatch<SetStateAction<DockLayout>>>(undefined as any)

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
  const state = useContext(LayoutContext)
  const dispatch = useContext(LayoutDispatchContext)

  return [state, dispatch]
}
