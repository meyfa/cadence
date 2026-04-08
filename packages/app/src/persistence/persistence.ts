import { useLayout, useLayoutDispatch, usePersistentBinding, type DockLayout, type PersistenceDomain } from '@editor'
import { defaultLayout } from '../defaults/default-layout.js'
import { dockLayoutSchema } from './layout.js'
import { string } from 'superstruct'
import { demoCode } from '../defaults/demo-code.js'
import { useCallback, useMemo } from 'react'
import { useEditor, useEditorDispatch } from '../components/contexts/EditorContext.js'

export const appPersistenceDefaults = {
  layout: defaultLayout,
  code: demoCode
}

const layoutDomain: PersistenceDomain<DockLayout> = {
  key: 'app.layout',
  fallbackValue: defaultLayout,
  serialize: (value) => value,
  deserialize: (value) => dockLayoutSchema.create(value),
  areEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
}

const editorDomain: PersistenceDomain<string> = {
  key: 'editor.code',
  fallbackValue: demoCode,
  serialize: (value) => value,
  deserialize: (value) => string().create(value),
  areEqual: (a, b) => a === b
}

export interface AppPersistenceSyncState {
  readonly loaded: boolean
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

  // editor

  const editor = useEditor()
  const editorDispatch = useEditorDispatch()

  const applyCode = useCallback((code: string) => {
    editorDispatch((state) => state.code === code ? state : { ...state, code })
  }, [editorDispatch])

  const { meta: editorMeta, controls: editorControls } = usePersistentBinding(editorDomain, editor.code, applyCode, {
    onConflict: 'manual'
  })

  // combined

  const loaded = layoutMeta.loaded && editorMeta.loaded
  const hasExternalChange = layoutMeta.conflict != null || editorMeta.conflict != null

  return useMemo(() => ({
    loaded,
    hasExternalChange,
    acceptRemoteChanges: () => {
      layoutControls.acceptRemote()
      editorControls.acceptRemote()
    },
    keepLocalChanges: () => {
      layoutControls.keepLocal()
      editorControls.keepLocal()
    }
  }), [loaded, hasExternalChange, layoutControls, editorControls])
}
