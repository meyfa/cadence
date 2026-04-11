import { useLayout, useLayoutDispatch, usePersistentBinding, type DockLayout, type PersistenceDomain } from '@editor'
import { useCallback, useMemo } from 'react'
import { record, string, type as structType } from 'superstruct'
import { defaultLayout } from '../defaults/default-layout.js'
import { demoCode } from '../defaults/demo-code.js'
import { useProjectSource, useProjectSourceDispatch } from '../project-source/ProjectSourceContext.js'
import { createProjectSourceState, type ProjectSourceState } from '../project-source/model.js'
import { dockLayoutSchema } from './layout.js'

export const appPersistenceDefaults = {
  layout: defaultLayout,
  source: createProjectSourceState(demoCode)
}

const layoutDomain: PersistenceDomain<DockLayout> = {
  key: 'app.layout',
  fallbackValue: defaultLayout,
  serialize: (value) => value,
  deserialize: (value) => dockLayoutSchema.create(value),
  areEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
}

const sourceStateSchema = structType({
  files: record(string(), string())
})

const sourceDomain: PersistenceDomain<ProjectSourceState> = {
  key: 'project.source',
  fallbackValue: createProjectSourceState(demoCode),
  serialize: (value) => value,
  deserialize: (value) => sourceStateSchema.create(value),
  areEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
}

export interface AppPersistenceSyncState {
  readonly hasExternalChange: boolean
  readonly acceptRemoteChanges: () => void
  readonly keepLocalChanges: () => void
}

export function useAppPersistenceSync (): AppPersistenceSyncState {
  // layout

  const layout = useLayout()
  const layoutDispatch = useLayoutDispatch()

  const { meta: layoutMeta, controls: layoutControls } = usePersistentBinding(layoutDomain, layout, layoutDispatch, {
    onConflict: 'manual'
  })

  // project source

  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()

  const applySource = useCallback((next: ProjectSourceState) => {
    sourceDispatch((state) => {
      return JSON.stringify(state) === JSON.stringify(next) ? state : next
    })
  }, [sourceDispatch])

  const { meta: sourceMeta, controls: sourceControls } = usePersistentBinding(sourceDomain, source, applySource, {
    onConflict: 'manual'
  })

  // combined

  const hasExternalChange = layoutMeta.conflict != null || sourceMeta.conflict != null

  return useMemo(() => ({
    hasExternalChange,
    acceptRemoteChanges: () => {
      layoutControls.acceptRemote()
      sourceControls.acceptRemote()
    },
    keepLocalChanges: () => {
      layoutControls.keepLocal()
      sourceControls.keepLocal()
    }
  }), [hasExternalChange, layoutControls, sourceControls])
}
