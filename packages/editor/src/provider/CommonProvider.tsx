import type { FunctionComponent, PropsWithChildren } from 'react'
import { CommandRegistryProvider } from '../commands/components/CommandRegistryContext.tsx'
import { MenuProvider } from '../commands/components/MenuContext.tsx'
import { DialogProvider } from '../dialogs/components/DialogContext.tsx'
import { LayoutProvider } from '../layout/components/LayoutContext.tsx'
import { ModuleProvider } from '../modules/components/ModuleContext.tsx'
import { ServiceProvider } from '../modules/components/ServiceContext.tsx'
import type { Module } from '../modules/types.ts'
import { NotificationProvider } from '../notifications/components/NotificationContext.tsx'
import { PersistenceProvider } from '../persistence/components/PersistenceContext.tsx'
import type { PersistenceEngine } from '../persistence/engine.tsx'
import { ProblemProvider } from '../problems/components/ProblemContext.tsx'
import { ProjectSourceProvider } from '../project-source/components/ProjectSourceContext.tsx'

export const CommonProvider: FunctionComponent<PropsWithChildren<{
  persistenceEngine: PersistenceEngine
  modules: readonly Module[]
}>> = ({ children, persistenceEngine, modules }) => {
  return (
    <PersistenceProvider engine={persistenceEngine}>
      <ProjectSourceProvider>
        <LayoutProvider>
          <DialogProvider>
            <NotificationProvider>
              <ServiceProvider>
                <CommandRegistryProvider>
                  <MenuProvider>
                    <ProblemProvider>
                      <ModuleProvider modules={modules}>
                        {children}
                      </ModuleProvider>
                    </ProblemProvider>
                  </MenuProvider>
                </CommandRegistryProvider>
              </ServiceProvider>
            </NotificationProvider>
          </DialogProvider>
        </LayoutProvider>
      </ProjectSourceProvider>
    </PersistenceProvider>
  )
}
