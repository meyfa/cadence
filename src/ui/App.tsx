import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header.js'
import { createAudioDemo } from '../core/audio-demo.js'
import { Editor } from './components/Editor.js'
import { parse } from '../language/parser.js'
import { Footer } from './components/Footer.js'
import { compile, type CompileOptions } from '../language/compiler/compiler.js'

const compileOptions: CompileOptions = {
  beatsPerBar: 4,
  stepsPerBeat: 4,
  tempo: {
    default: 128,
    minimum: 1,
    maximum: 400
  }
}

const initialCode = `
# Press Play to start the demo.

# Define samples to use in the track.

sample_collection = "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/"

kick  = sample(url: sample_collection + "house/000_BD.wav")
snare = sample(url: sample_collection + "808sd/SD0010.WAV")
hat   = sample(url: sample_collection + "808oh/OH00.WAV")
tom   = sample(url: sample_collection + "808mt/MT10.WAV")

# Define patterns using a simple step sequencer syntax where 'x' is a hit and '-' is a rest.
# Patterns are 16th notes by default, and can be any length.

kick_pattern  = [x-x- x--- x--- x---]
snare_pattern = [---- x---]

track {
  tempo: 128 bpm

  # Sections play in sequence.
  # Patterns will loop to fill the section length, specified in bars or beats.

  section intro for 4 bars {
    kick  << kick_pattern
    snare << snare_pattern
  }

  section main for 8 bars {
    kick  << kick_pattern
    snare << snare_pattern
    hat   << [--x- --x- --x- --x-]
    tom   << [---- -x-- ---- ---x]
  }

  section outro for 4 bars {
    snare << snare_pattern
    tom   << [---- -x-- ---- ---x]
  }
}
`.trimStart()

const demo = createAudioDemo()

export const App: FunctionComponent = () => {
  const [code, setCode] = useState(initialCode)
  const [editorLocation, setEditorLocation] = useState<{ line: number, column: number } | undefined>()

  const parseResult = useMemo(() => parse(code), [code])

  const compileResult = useMemo(() => {
    if (!parseResult.complete) {
      return undefined
    }

    return compile(parseResult.value, compileOptions)
  }, [parseResult])

  const errors = useMemo(() => {
    if (!parseResult.complete) {
      return [parseResult.error]
    }

    if (compileResult?.complete === false) {
      return compileResult.error.errors
    }

    return []
  }, [parseResult, compileResult])

  useEffect(() => {
    if (compileResult?.complete === true) {
      demo.setProgram(compileResult.value)
    }
  }, [compileResult])

  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(50)

  useEffect(() => {
    if (playing) {
      demo.play()
    } else {
      demo.stop()
    }
  }, [playing])

  const update = useCallback(() => {
    demo.stop()
    if (playing) {
      demo.play()
    }
  }, [playing])

  useEffect(() => {
    demo.setVolume(volume / 100)
  }, [volume])

  return (
    <div className='flex flex-col h-screen'>
      <Header
        playing={playing}
        onPlayPause={() => setPlaying((playing) => !playing)}
        volume={volume}
        onVolumeChange={setVolume}
        onUpdate={update}
      />

      <Editor value={code} onChange={setCode} onLocationChange={setEditorLocation} />

      <Footer errors={errors} editorLocation={editorLocation} />
    </div>
  )
}
