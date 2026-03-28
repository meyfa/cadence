import { useSafeContext } from '@editor'
import { createContext, type FunctionComponent, type PropsWithChildren } from 'react'
import type { MenuSpec } from '../commands/menu-types.js'

const MenuContext = createContext<readonly MenuSpec[] | undefined>([])

export const MenuProvider: FunctionComponent<PropsWithChildren<{
  menus: readonly MenuSpec[]
}>> = ({ menus, children }) => {
  return (
    <MenuContext value={menus}>
      {children}
    </MenuContext>
  )
}

export function useMenuSpecs (): readonly MenuSpec[] {
  return useSafeContext(MenuContext, 'MenuContext')
}
