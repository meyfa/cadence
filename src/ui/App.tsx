import { FunctionComponent, useEffect, useState } from 'react'
import { Header } from './components/Header.js'
import { createAudioDemo } from '../core/audio-demo.js'
import { Editor } from './components/Editor.js'

const demo = createAudioDemo()

export const App: FunctionComponent = () => {
  const [code, setCode] = useState('# Welcome to Cadence')

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
        onVolumeChange={setVolume} />

      <div className='flex flex-col h-[calc(100vh-3rem)] min-h-0'>
        <Editor value={code} onChange={setCode} />
      </div>
    </>
  )
}
