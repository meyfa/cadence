import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header.js'
import { createAudioDemo } from '../core/audio-demo.js'
import { Editor } from './components/Editor.js'
import { parse } from '../language/parser.js'
import clsx from 'clsx'

const initialCode = `
# Press Play to start the demo. Edit the code to create your own patterns.
# Use 'x' for a hit and '-' for a rest.

track {
  tempo: 128 bpm
}

kick  = sample(url: "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/house/000_BD.wav")
snare = sample(url: "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808sd/SD0010.WAV")
hat   = sample(url: "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808oh/OH00.WAV")
tom   = sample(url: "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808mt/MT10.WAV")

kick  << [x-x- x--- x--- x---]
snare << [---- x--- ---- x---]
hat   << [--x- --x- --x- --x-]

# You can also define patterns and reuse them.

tom_pattern = [---- -x-- ---- ---x]
tom   << tom_pattern
`.trimStart()

const demo = createAudioDemo({
  defaultTempo: 128
})

export const App: FunctionComponent = () => {
  const [code, setCode] = useState(initialCode)

  const parseResult = useMemo(() => {
    return parse(code)
  }, [code])

  useEffect(() => {
    if (parseResult.complete) {
      demo.setProgram(parseResult.value)
    }
  }, [parseResult])

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
    <>
      <Header
        playing={playing}
        onPlayPause={() => setPlaying((playing) => !playing)}
        volume={volume}
        onVolumeChange={setVolume}
        onUpdate={update}
      />

      <div className='flex flex-col h-[calc(100vh-5rem)] min-h-0'>
        <Editor value={code} onChange={setCode} />
      </div>

      <div className={clsx('p-2 text-xs text-gray-500', !parseResult.complete && 'bg-red-500/20 text-red-500')}>
        {parseResult.complete
          ? 'No errors'
          : 'Parsing failed'}
      </div>
    </>
  )
}
