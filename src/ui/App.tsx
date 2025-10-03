import { FunctionComponent, useEffect, useMemo, useState } from 'react'
import { Header } from './components/Header.js'
import { createAudioDemo } from '../core/audio-demo.js'
import { Editor } from './components/Editor.js'
import { parse } from '../language/parser.js'
import clsx from 'clsx'

const initialCode = `
# Press Play to start the demo. Edit the code to create your own patterns.
# Use 'x' for a hit and '-' for a rest.

kick  = [x--- x--- x--- x---]
snare = [---- x--- ---- x---]
hat   = [--x- --x- --x- --x-]
tom   = [---- -x-- ---- ---x]
`.trimStart()

const instruments = {
  kick: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/house/000_BD.wav',
  snare: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808sd/SD0010.WAV',
  hat: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808oh/OH00.WAV',
  tom: 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/808mt/MT10.WAV'
}

const demo = createAudioDemo({
  instruments
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
