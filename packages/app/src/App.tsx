import { makeNumeric } from '@core/program.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from '@editor/state/state.js'
import { BrowserLocalStorage } from '@editor/storage.js'
import { type CompileOptions } from '@language/compiler/compiler.js'
import { createAudioEngine, type AudioEngineOptions } from '@webaudio/engine.js'
import { FunctionComponent, useEffect, useLayoutEffect, useState } from 'react'
import { ConfirmationDialog } from './components/dialogs/ConfirmationDialog.js'
import { Footer } from './components/Footer.js'
import { Header } from './components/Header.js'
import { Main } from './components/Main.js'
import { demoCode } from './demo.js'
import { useObservable } from './hooks/observable.js'
import { AudioEngineContext } from './state/AudioEngineContext.js'
import { CompilationProvider } from './state/CompilationContext.js'
import { defaultLayout } from './state/default-layout.js'
import { DialogProvider } from './state/DialogContext.js'
import { EditorProvider, useEditor } from './state/EditorContext.js'
import { LayoutProvider, useLayout } from './state/LayoutContext.js'
import { applyThemeSetting, useThemeSetting } from './theme.js'

const STORAGE_KEY = 'cadence-editor'
const STORAGE_DEBOUNCE_MS = 250

const compileOptions: CompileOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 128,
    minimum: 1,
    maximum: 400
  }
}

const lowMemoryDevice = 'deviceMemory' in navigator
  ? (navigator as any).deviceMemory <= 2
  : undefined

const likelyMobile = 'userAgentData' in navigator && 'mobile' in (navigator as any).userAgentData
  ? (navigator as any).userAgentData.mobile === true
  : matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) <= 768

const audioEngineOptions = {
  cacheLimits: lowMemoryDevice === true || likelyMobile
    ? {
        arrayBuffer: 60 * 1024 * 1024, // compressed: 60 MB
        audioBuffer: 30 * 1024 * 1024 // decompressed: 30 MB
      }
    : {
        arrayBuffer: 200 * 1024 * 1024, // compressed: 200 MB
        audioBuffer: 100 * 1024 * 1024 // decompressed: 100 MB
      }
} satisfies Partial<AudioEngineOptions>

const defaultState: CadenceEditorState = {
  settings: {
    theme: 'dark',
    outputGain: makeNumeric('db', -12)
  },
  layout: defaultLayout,
  code: demoCode
}

const storage = new BrowserLocalStorage(STORAGE_KEY, serializeEditorState, parseEditorState)
const storedState = storage.load()

const initialState: CadenceEditorState = {
  settings: {
    theme: storedState?.settings?.theme ?? defaultState.settings.theme,
    outputGain: storedState?.settings?.outputGain ?? defaultState.settings.outputGain
  },
  layout: storedState?.layout ?? defaultState.layout,
  code: storedState?.code ?? defaultState.code
}

const engine = createAudioEngine({
  ...audioEngineOptions,
  outputGain: initialState.settings.outputGain
})

export const App: FunctionComponent = () => {
  const [hasExternalChange, setHasExternalChange] = useState(false)

  return (
    <AudioEngineContext value={engine}>
      <EditorProvider>
        <CompilationProvider compileOptions={compileOptions}>
          <LayoutProvider>
            <DialogProvider>
              <StorageSync
                onExternalChange={() => setHasExternalChange(true)}
                disablePersistence={hasExternalChange}
              />

              <ConfirmationDialog
                open={hasExternalChange}
                title='External changes detected'
                onConfirm={() => window.location.reload()}
                onCancel={() => setHasExternalChange(false)}
                confirmText='Reload'
                cancelText='Ignore'
              >
                The editor state has changed in another tab or window. Reload to apply the changes?
              </ConfirmationDialog>

              <div className='flex flex-col h-dvh'>
                <Header />
                <Main />
                <Footer />
              </div>
            </DialogProvider>
          </LayoutProvider>
        </CompilationProvider>
      </EditorProvider>
    </AudioEngineContext>
  )
}

// Helper component for syncing to storage
const StorageSync: FunctionComponent<{
  onExternalChange: () => void
  disablePersistence?: boolean
}> = ({ onExternalChange, disablePersistence }) => {
  const theme = useThemeSetting()
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
    return storage.onExternalChange(() => {
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

      onExternalChange()
    })
  }, [onExternalChange, engine])

  // Debounced persistence
  useEffect(() => {
    if (disablePersistence === true) {
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
    }, STORAGE_DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [disablePersistence, theme, outputGain, layout, code])

  return null
}
