import type { FunctionComponent, PropsWithChildren } from 'react'
import { CommandRegistryProvider } from '../commands/components/CommandRegistryContext.js'
import { MenuProvider } from '../commands/components/MenuContext.js'
import { DialogProvider } from '../dialogs/components/DialogContext.js'
import { LayoutProvider } from '../layout/components/LayoutContext.js'
import { ModuleProvider } from '../modules/components/ModuleContext.js'
import type { Module } from '../modules/types.js'
import { NotificationProvider } from '../notifications/components/NotificationContext.js'

export const CommonProvider: FunctionComponent<PropsWithChildren<{
  modules: readonly Module[]
}>> = ({ children, modules }) => {
  return (
    <LayoutProvider>
      <DialogProvider>
        <NotificationProvider>
          <CommandRegistryProvider>
            <MenuProvider>
              <ModuleProvider modules={modules}>
                {children}
              </ModuleProvider>
            </MenuProvider>
          </CommandRegistryProvider>
        </NotificationProvider>
      </DialogProvider>
    </LayoutProvider>
  )
}
