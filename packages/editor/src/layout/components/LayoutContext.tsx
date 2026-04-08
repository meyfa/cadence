import { createContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { DockLayout } from '../types.js'

const initialLayoutState: DockLayout = {
  main: undefined
}

function layoutReducer (state: DockLayout, action: SetStateAction<DockLayout>): DockLayout {
  return typeof action === 'function' ? action(state) : action
}

export type LayoutDispatch = Dispatch<SetStateAction<DockLayout>>

export const LayoutContext = createContext<DockLayout | undefined>(undefined)
export const LayoutDispatchContext = createContext<Dispatch<SetStateAction<DockLayout>> | undefined>(undefined)

export const LayoutProvider: FunctionComponent<PropsWithChildren<{
  initialLayout?: DockLayout
}>> = ({ children, initialLayout = initialLayoutState }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialLayout)

  return (
    <LayoutContext value={state}>
      <LayoutDispatchContext value={dispatch}>
        {children}
      </LayoutDispatchContext>
    </LayoutContext>
  )
}

export function useLayout (): DockLayout {
  return useSafeContext(LayoutContext, 'LayoutContext')
}

export function useLayoutDispatch (): LayoutDispatch {
  return useSafeContext(LayoutDispatchContext, 'LayoutDispatchContext')
}
