import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header.js'
import { createAudioEngine } from '../core/audio.js'
import { Editor } from './components/Editor.js'
import { parse } from '../language/parser/parser.js'
import { Footer } from './components/Footer.js'
import { compile, type CompileOptions } from '../language/compiler/compiler.js'
import { BrowserLocalStorage } from '../editor/storage.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from '../editor/state.js'
import { demoCode } from './demo.js'
import { lex } from '../language/lexer/lexer.js'
import type { EditorLocation } from '../editor/editor.js'

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

const initialState = {
  ...defaultState,
  ...storedState,
  code: storedState?.code == null || storedState.code.trim() === '' ? demoCode : storedState.code
}

const engine = createAudioEngine()

export const App: FunctionComponent = () => {
  const [code, setCode] = useState(initialState.code)
  const [volume, setVolume] = useState(initialState.settings.volume)

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

  // Collect errors from parsing and compiling
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

  // Update audio engine with compiled program
  useEffect(() => {
    if (compileResult?.complete === true) {
      engine.setProgram(compileResult.value)
    }
  }, [compileResult])

  // Playback state
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (playing) {
      engine.play()
    } else {
      engine.stop()
    }
  }, [playing])

  const update = useCallback(() => {
    engine.stop()
    if (playing) {
      engine.play()
    }
  }, [playing])

  useEffect(() => engine.setVolume(volume), [volume])

  // Track editor cursor location
  const [editorLocation, setEditorLocation] = useState<EditorLocation | undefined>()

  return (
    <div className='flex flex-col h-screen'>
      <Header
        playing={playing}
        onPlayPause={() => setPlaying((playing) => !playing)}
        volume={volume}
        onVolumeChange={setVolume}
        onUpdate={update}
      />

      <Editor document={code} onChange={setCode} onLocationChange={setEditorLocation} />

      <Footer errors={errors} editorLocation={editorLocation} />
    </div>
  )
}
