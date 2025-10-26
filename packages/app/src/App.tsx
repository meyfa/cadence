import { createAudioEngine } from '@core/audio/engine.js'
import { makeNumeric } from '@core/program.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from '@editor/state.js'
import { BrowserLocalStorage } from '@editor/storage.js'
import { type CompileOptions } from '@language/compiler/compiler.js'
import { FunctionComponent, useEffect } from 'react'
import { Footer } from './components/Footer.js'
import { Header } from './components/Header.js'
import { Main } from './components/Main.js'
import { demoCode } from './demo.js'
import { useObservable } from './hooks/observable.js'
import { AudioEngineContext } from './state/AudioEngineContext.js'
import { CompilationProvider } from './state/CompilationContext.js'
import { EditorProvider, useEditor } from './state/EditorContext.js'
import { applyThemeSetting, useThemeSetting } from './theme.js'

const compileOptions: CompileOptions = {
  beatsPerBar: 4,
  stepsPerBeat: 4,
  tempo: {
    default: 128,
    minimum: 1,
    maximum: 400
  }
}

const defaultState: CadenceEditorState = {
  code: demoCode,
  settings: {
    theme: 'dark',
    outputGain: makeNumeric('db', -12)
  }
}

const storage = new BrowserLocalStorage('cadence-editor', serializeEditorState, parseEditorState)
const storedState = storage.load()

const initialState: CadenceEditorState = {
  code: storedState?.code ?? defaultState.code,
  settings: {
    theme: storedState?.settings?.theme ?? defaultState.settings.theme,
    outputGain: storedState?.settings?.outputGain ?? defaultState.settings.outputGain
  }
}

const engine = createAudioEngine({
  outputGain: initialState.settings.outputGain
})

export const App: FunctionComponent = () => {
  return (
    <AudioEngineContext value={engine}>
      <EditorProvider>
        <CompilationProvider compileOptions={compileOptions}>
          <StorageSync />
          <div className='flex flex-col h-dvh'>
            <Header />
            <Main />
            <Footer />
          </div>
        </CompilationProvider>
      </EditorProvider>
    </AudioEngineContext>
  )
}

// Helper component for syncing to storage
const StorageSync: FunctionComponent = () => {
  const theme = useThemeSetting()
  const outputGain = useObservable(engine.outputGain)

  const [editor, editorDispatch] = useEditor()

  // Apply initial data on mount
  useEffect(() => {
    applyThemeSetting(initialState.settings.theme)
    editorDispatch((state) => ({ ...state, code: initialState.code }))
  }, [])

  useEffect(() => {
    storage.save({
      settings: {
        theme,
        outputGain
      },
      code: editor.code
    })
  }, [theme, outputGain, editor.code])

  return null
}
