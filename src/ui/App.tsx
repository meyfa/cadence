import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header.js'
import { createAudioEngine } from '../core/audio/engine.js'
import { Editor } from './components/Editor.js'
import { parse } from '../language/parser/parser.js'
import { Footer } from './components/Footer.js'
import { compile, type CompileOptions } from '../language/compiler/compiler.js'
import { BrowserLocalStorage } from '../editor/storage.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from '../editor/state.js'
import { demoCode } from './demo.js'
import { lex } from '../language/lexer/lexer.js'
import type { EditorLocation } from '../editor/editor.js'
import { useObservable } from './hooks/observable.js'
import { TabLayout } from './layout/TabLayout.js'
import { SettingsPage } from './pages/SettingsPage.js'

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
    volume: 0.5
  }
}

const storage = new BrowserLocalStorage<CadenceEditorState>('cadence-editor', serializeEditorState, parseEditorState)
const storedState = storage.load()

const initialState: CadenceEditorState = {
  ...defaultState,
  ...storedState,
  code: storedState?.code == null || storedState.code.trim() === '' ? demoCode : storedState.code
}

const engine = createAudioEngine({
  volume: initialState.settings.volume
})

export const App: FunctionComponent = () => {
  const [code, setCode] = useState(initialState.code)
  const volume = useObservable(engine.volume)
  const playing = useObservable(engine.playing)
  const progress = useObservable(engine.progress)

  // Synchronize state with local storage
  useEffect(() => {
    storage.save({ code, settings: { volume } })
  }, [code, volume])

  // Lex, parse, and compile code

  const lexResult = useMemo(() => lex(code), [code])

  const parseResult = useMemo(() => {
    if (lexResult.complete) {
      return parse(lexResult.value)
    }
  }, [lexResult])

  const compileResult = useMemo(() => {
    if (parseResult?.complete === true) {
      return compile(parseResult.value, compileOptions)
    }
  }, [parseResult])

  const errors = useMemo(() => {
    if (!lexResult.complete) {
      return [lexResult.error]
    }
    if (parseResult?.complete === false) {
      return [parseResult.error]
    }
    if (compileResult?.complete === false) {
      return compileResult.error.errors
    }
    return []
  }, [parseResult, compileResult])

  const program = compileResult?.complete === true ? compileResult.value : undefined

  // Handle play/pause
  const onPlayPause = useCallback(() => {
    if (playing) {
      engine.stop()
    } else if (program != null) {
      engine.play(program)
    }
  }, [playing, program])

  // Track editor cursor location
  const [editorLocation, setEditorLocation] = useState<EditorLocation | undefined>()

  // Settings
  const loadDemo = useCallback(() => {
    setCode(demoCode)
  }, [])

  return (
    <div className='flex flex-col h-screen'>
      <Header
        playing={playing}
        onPlayPause={onPlayPause}
        volume={volume}
        onVolumeChange={(volume) => engine.volume.set(volume)}
        progress={progress}
      />

      <TabLayout tabs={[
        {
          title: 'Editor',
          render: () => (
            <Editor document={code} onChange={setCode} onLocationChange={setEditorLocation} />
          )
        },
        {
          title: 'Settings',
          render: () => (<SettingsPage loadDemo={loadDemo} />)
        }
      ]}
      />

      <Footer errors={errors} editorLocation={editorLocation} />
    </div>
  )
}
