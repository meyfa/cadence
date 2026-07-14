import { useMemo } from 'react'
import { useModules } from '../../modules/components/ModuleContext.tsx'
import type { Module, Panel, PanelId } from '../../modules/types.ts'

export function usePanelById (id: PanelId): Panel | undefined {
  const modules = useModules()

  return useMemo(() => findPanelById(modules, id), [modules, id])
}

export function findPanelById (modules: readonly Module[], id: PanelId): Panel | undefined {
  for (const module of modules) {
    for (const panel of module.panels ?? []) {
      if (panel.id === id) {
        return panel
      }
    }
  }

  return undefined
}
