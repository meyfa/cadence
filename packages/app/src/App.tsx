import { createAudioEngine } from '@core/audio/engine.js'
import { makeNumeric } from '@core/program.js'
import type { DockLayout } from '@editor/state/layout.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from '@editor/state/state.js'
import { BrowserLocalStorage } from '@editor/storage.js'
import { type CompileOptions } from '@language/compiler/compiler.js'
import { FunctionComponent, useEffect } from 'react'
import { Footer } from './components/Footer.js'
import { Header } from './components/Header.js'
import { Main } from './components/Main.js'
import { demoCode } from './demo.js'
import { useObservable } from './hooks/observable.js'
import { TabTypes } from './panes/render-tab.js'
import { AudioEngineContext } from './state/AudioEngineContext.js'
import { CompilationProvider } from './state/CompilationContext.js'
import { EditorProvider, useEditor } from './state/EditorContext.js'
import { LayoutProvider, useLayout } from './state/LayoutContext.js'
import { applyThemeSetting, useThemeSetting } from './theme.js'

const STORAGE_KEY = 'cadence-editor'
const STORAGE_DEBOUNCE_MS = 250

const compileOptions: CompileOptions = {
  beatsPerBar: 4,
  stepsPerBeat: 4,
  tempo: {
    default: 128,
    minimum: 1,
    maximum: 400
  }
}

const defaultLayout: DockLayout = {
  main: {
    id: 'main-split',
    type: 'split',
    direction: 'vertical',
    sizes: [0.8, 0.2],
    children: [
      {
        id: 'main-tabs',
        type: 'pane',
        tabs: [
          { id: 'editor', component: { type: TabTypes.Editor } },
          { id: 'mixer', component: { type: TabTypes.Mixer } },
          { id: 'settings', component: { type: TabTypes.Settings } }
        ],
        activeTabId: 'editor'
      },
      {
        id: 'bottom-dock',
        type: 'pane',
        tabs: [
          { id: 'problems', component: { type: TabTypes.Problems } },
          { id: 'timeline', component: { type: TabTypes.Timeline } }
        ],
        activeTabId: 'timeline'
      }
    ]
  }
}

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
  outputGain: initialState.settings.outputGain
})

export const App: FunctionComponent = () => {
  return (
    <AudioEngineContext value={engine}>
      <EditorProvider>
        <CompilationProvider compileOptions={compileOptions}>
          <LayoutProvider>
            <StorageSync />
            <div className='flex flex-col h-dvh'>
              <Header />
              <Main />
              <Footer />
            </div>
          </LayoutProvider>
        </CompilationProvider>
      </EditorProvider>
    </AudioEngineContext>
  )
}

// Helper component for syncing to storage
const StorageSync: FunctionComponent = () => {
  const theme = useThemeSetting()
  const outputGain = useObservable(engine.outputGain)

  const [layout, layoutDispatch] = useLayout()

  const [editor, editorDispatch] = useEditor()
  const { code } = editor

  // Apply initial data on mount
  useEffect(() => {
    applyThemeSetting(initialState.settings.theme)
    layoutDispatch(initialState.layout)
    editorDispatch((state) => ({ ...state, code: initialState.code }))
  }, [])

  // Debounced persistence
  useEffect(() => {
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
  }, [theme, outputGain, layout, code])

  return null
}
