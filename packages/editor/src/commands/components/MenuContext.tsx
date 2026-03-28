import { createContext, useCallback, useEffect, useMemo, useState, type DependencyList, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { MenuSpec } from '../menus.js'

type Unregister = () => void

interface MenuContextValue {
  readonly menuSpecs: readonly MenuSpec[]
  readonly registerMenu: (menu: MenuSpec) => Unregister
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined)

export const MenuProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [menuSpecs, setMenuSpecs] = useState<readonly MenuSpec[]>([])

  const registerMenu = useCallback((menu: MenuSpec): Unregister => {
    setMenuSpecs((prev) => [...prev, menu])
    return () => setMenuSpecs((prev) => prev.filter((item) => item !== menu))
  }, [])

  const value = useMemo(() => ({
    menuSpecs,
    registerMenu
  }), [menuSpecs, registerMenu])

  return (
    <MenuContext value={value}>
      {children}
    </MenuContext>
  )
}

export function useMenuSpecs (): readonly MenuSpec[] {
  const context = useSafeContext(MenuContext, 'MenuContext')
  return context.menuSpecs
}

export function useRegisterMenu (
  menu: MenuSpec | (() => MenuSpec),
  deps: DependencyList = []
): void {
  const { registerMenu } = useSafeContext(MenuContext, 'MenuContext')

  const instance = useMemo(() => {
    return typeof menu === 'function' ? menu() : menu
  }, deps)

  useEffect(() => registerMenu(instance), [instance, registerMenu])
}
