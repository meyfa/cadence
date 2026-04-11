import { createProjectSourceState, useLayout, useLayoutDispatch, usePersistentBinding, useProjectSource, useProjectSourceDispatch, type DockLayout, type PersistenceDomain, type ProjectSource } from '@editor'
import { useCallback, useMemo } from 'react'
import { record, string, type as structType } from 'superstruct'
import { defaultLayout } from '../defaults/default-layout.js'
import { demoCode } from '../defaults/demo-code.js'
import { TRACK_FILE_PATH } from './constants.js'
import { dockLayoutSchema } from './layout.js'

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

const sourceDomain: PersistenceDomain<ProjectSource> = {
  key: 'project.source',
  fallbackValue: createProjectSourceState({
    [TRACK_FILE_PATH]: demoCode
  }),
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

  const applySource = useCallback((next: ProjectSource) => {
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
