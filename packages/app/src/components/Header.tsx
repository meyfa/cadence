import { PlayArrowOutlined, StopOutlined } from '@mui/icons-material'
import { FunctionComponent, useCallback } from 'react'
import { useObservable } from '../hooks/observable.js'
import { usePrevious } from '../hooks/previous.js'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import { useCompilationState } from '../state/CompilationContext.js'
import { Button } from './Button.js'
import { GainSlider } from './settings/GainSlider.js'

export const Header: FunctionComponent = () => {
  const { program } = useCompilationState()
  const lastProgram = usePrevious(program)

  const engine = useAudioEngine()

  const playing = useObservable(engine.playing)
  const progress = useObservable(engine.progress)

  const outputGain = useObservable(engine.outputGain)

  const onPlayPause = useCallback(() => {
    if (playing) {
      engine.stop()
    } else if (lastProgram != null) {
      engine.play(lastProgram)
    }
  }, [engine, playing, lastProgram])

  return (
    <header className='flex flex-wrap items-center px-4 py-1 gap-2 bg-surface-200'>
      <div className='text-lg font-semibold mr-2'>
        Cadence
      </div>

      <div className='w-56'>
        <GainSlider label='Output gain' gain={outputGain} onChange={(gain) => engine.outputGain.set(gain)} />
      </div>

      <Button onClick={onPlayPause} title={playing ? 'Stop' : 'Play'}>
        {playing ? <StopOutlined /> : <PlayArrowOutlined />}
      </Button>

      <div title='Progress' className='grow min-w-24 max-w-64 flex items-center h-8'>
        <div className='w-full h-2 bg-surface-200 border border-frame-200 rounded-xs overflow-hidden'>
          <div
            className='h-full bg-content-200 transition-all duration-100 ease-linear'
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
      </div>
    </header>
  )
}
