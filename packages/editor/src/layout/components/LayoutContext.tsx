import type { Dispatch, FunctionComponent, PropsWithChildren, SetStateAction } from 'react'
import { createContext, useReducer } from 'react'
import { useSafeContext } from '../../hooks/safe-context.ts'
import type { DockLayout } from '../types.ts'

const initialLayoutState: DockLayout = {
  main: undefined
}

function layoutReducer (state: DockLayout, action: SetStateAction<DockLayout>): DockLayout {
  return typeof action === 'function' ? action(state) : action
}

export type LayoutDispatch = Dispatch<SetStateAction<DockLayout>>

export const LayoutContext = createContext<DockLayout | undefined>(undefined)
export const LayoutDispatchContext = createContext<Dispatch<SetStateAction<DockLayout>> | undefined>(undefined)

export const LayoutProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(layoutReducer, initialLayoutState)

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
