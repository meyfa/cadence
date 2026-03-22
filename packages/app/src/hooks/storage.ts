import { numeric } from '@utility'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useEditor } from '../state/EditorContext.js'
import { useLayout } from '../state/LayoutContext.js'
import { applyThemeSetting, useThemeSetting } from '../theme.js'
import { useObservable } from './observable.js'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import type { CadenceEditorState, PartialCadenceEditorState, Storage } from '@editor'

const STORAGE_DEBOUNCE = numeric('s', 0.25)

type StorageSyncState = readonly [
  hasExternalChange: boolean,
  resetExternalChange: () => void
]

export function useStorageSync (
  storage: Storage<CadenceEditorState, PartialCadenceEditorState>,
  initialState: CadenceEditorState
): StorageSyncState {
  const [hasExternalChange, setHasExternalChange] = useState(false)

  const resetExternalChange = useCallback(() => {
    setHasExternalChange(false)
  }, [])

  const theme = useThemeSetting()

  const engine = useAudioEngine()
  const outputGain = useObservable(engine.outputGain)

  const [layout, layoutDispatch] = useLayout()

  const [editor, editorDispatch] = useEditor()
  const { code } = editor

  // Apply initial data on mount
  useLayoutEffect(() => {
    applyThemeSetting(initialState.settings.theme)
    layoutDispatch(initialState.layout)
    editorDispatch((state) => ({ ...state, code: initialState.code }))
  }, [])

  // Update on external storage changes (e.g. other tabs)
  useEffect(() => {
    return storage.onExternalChange?.(() => {
      const externalState = storage.load()
      if (externalState == null) {
        return
      }

      // Syncing anything but basic settings can easily cause loops or mess up the user's current work.
      const { settings } = externalState
      if (settings?.theme != null) {
        applyThemeSetting(settings.theme)
      }
      if (settings?.outputGain != null) {
        engine.outputGain.set(settings.outputGain)
      }

      setHasExternalChange(true)
    })
  }, [engine])

  // Debounced persistence
  useEffect(() => {
    if (hasExternalChange) {
      return
    }

    const handle = setTimeout(() => {
      storage.save({
        settings: {
          theme,
          outputGain
        },
        layout,
        code
      })
    }, STORAGE_DEBOUNCE.value * 1000)

    return () => clearTimeout(handle)
  }, [hasExternalChange, theme, outputGain, layout, code])

  return [
    hasExternalChange,
    resetExternalChange
  ]
}
