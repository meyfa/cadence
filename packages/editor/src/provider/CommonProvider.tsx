import type { FunctionComponent, PropsWithChildren } from 'react'
import { CommandRegistryProvider } from '../commands/components/CommandRegistryContext.js'
import { MenuProvider } from '../commands/components/MenuContext.js'
import { DialogProvider } from '../dialogs/components/DialogContext.js'
import { LayoutProvider } from '../layout/components/LayoutContext.js'
import { ModuleProvider } from '../modules/components/ModuleContext.js'
import type { Module } from '../modules/types.js'
import { NotificationProvider } from '../notifications/components/NotificationContext.js'
import { PersistenceProvider } from '../persistence/components/PersistenceContext.js'
import type { PersistenceEngine } from '../persistence/engine.js'
import { ProblemProvider } from '../problems/components/ProblemContext.js'

export const CommonProvider: FunctionComponent<PropsWithChildren<{
  persistenceEngine: PersistenceEngine
  modules: readonly Module[]
}>> = ({ children, persistenceEngine, modules }) => {
  return (
    <PersistenceProvider engine={persistenceEngine}>
      <LayoutProvider>
        <DialogProvider>
          <NotificationProvider>
            <CommandRegistryProvider>
              <MenuProvider>
                <ProblemProvider>
                  <ModuleProvider modules={modules}>
                    {children}
                  </ModuleProvider>
                </ProblemProvider>
              </MenuProvider>
            </CommandRegistryProvider>
          </NotificationProvider>
        </DialogProvider>
      </LayoutProvider>
    </PersistenceProvider>
  )
}
