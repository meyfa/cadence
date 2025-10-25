import { createAudioEngine } from '@core/audio/engine.js'
import { makeNumeric } from '@core/program.js'
import type { EditorLocation } from '@editor/editor.js'
import { DockLayout } from '@editor/layout.js'
import { parseEditorState, serializeEditorState, type CadenceEditorState } from '@editor/state.js'
import { BrowserLocalStorage } from '@editor/storage.js'
import { compile, type CompileOptions } from '@language/compiler/compiler.js'
import { lex } from '@language/lexer/lexer.js'
import { parse } from '@language/parser/parser.js'
import { FunctionComponent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { EditorFooter } from './components/editor/EditorFooter.js'
import { Header } from './components/Header.js'
import { demoCode } from './demo.js'
import { useObservable } from './hooks/observable.js'
import { usePrevious } from './hooks/previous.js'
import { DockLayoutView } from './layout/DockLayoutView.js'
import { EditorPage } from './panes/EditorPane.js'
import { MixerPage } from './panes/MixerPane.js'
import { ProblemsPane } from './panes/ProblemsPane.js'
import { SettingsPage } from './panes/SettingsPane.js'
import { TimelinePage } from './panes/TimelinePane.js'

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
    outputGain: makeNumeric('db', -12)
  }
}

const storage = new BrowserLocalStorage('cadence-editor', serializeEditorState, parseEditorState)
const storedState = storage.load()

const initialState: CadenceEditorState = {
  code: storedState?.code ?? defaultState.code,
  settings: {
    outputGain: storedState?.settings?.outputGain ?? defaultState.settings.outputGain
  }
}

const engine = createAudioEngine({
  outputGain: initialState.settings.outputGain
})

export const App: FunctionComponent = () => {
  const [code, setCode] = useState(initialState.code)
  const outputGain = useObservable(engine.outputGain)
  const playing = useObservable(engine.playing)
  const progress = useObservable(engine.progress)

  // Synchronize state with local storage
  useEffect(() => {
    storage.save({ code, settings: { outputGain } })
  }, [code, outputGain])

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
  const lastProgram = usePrevious(program)

  // Handle play/pause
  const onPlayPause = useCallback(() => {
    if (playing) {
      engine.stop()
    } else if (lastProgram != null) {
      engine.play(lastProgram)
    }
  }, [playing, lastProgram])

  // Settings
  const loadDemo = useCallback(() => {
    setCode(demoCode)
  }, [])

  // Layout

  const [editorLocation, setEditorLocation] = useState<EditorLocation | undefined>()

  const layout = useMemo<DockLayout<ReactNode>>(() => {
    return {
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
              {
                id: 'editor',
                title: 'Editor',
                render: () => (
                  <EditorPage value={code} onChange={setCode} onLocationChange={setEditorLocation} />
                )
              },
              {
                id: 'mixer',
                title: 'Mixer',
                render: () => (<MixerPage program={lastProgram} />)
              },
              {
                id: 'settings',
                title: 'Settings',
                render: () => (<SettingsPage loadDemo={loadDemo} />)
              }
            ],
            activeTabId: 'editor'
          },
          {
            id: 'bottom-dock',
            type: 'pane',
            tabs: [
              {
                id: 'problems',
                title: 'Problems',
                render: () => (<ProblemsPane errors={errors} />),
                notificationCount: errors.length
              },
              {
                id: 'timeline',
                title: 'Timeline',
                render: () => (<TimelinePage program={lastProgram} playbackProgress={playing ? progress : undefined} />)
              }
            ],
            activeTabId: 'timeline'
          }
        ]
      }
    }
  }, [code, errors, lastProgram, playing, progress, loadDemo])

  return (
    <div className='flex flex-col h-dvh'>
      <Header
        playing={playing}
        onPlayPause={onPlayPause}
        outputGain={outputGain}
        onOutputGainChange={(gain) => engine.outputGain.set(gain)}
        progress={progress}
      />

      <DockLayoutView
        layout={layout}
        className='flex-1 min-h-0 min-w-0'
      />

      <EditorFooter
        errors={errors}
        editorLocation={editorLocation}
      />
    </div>
  )
}
