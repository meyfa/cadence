import { PlayArrowOutlined, StopOutlined } from '@mui/icons-material'
import { FunctionComponent, useCallback } from 'react'
import { useObservable } from '../hooks/observable.js'
import { usePrevious } from '../hooks/previous.js'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import { useCompilationState } from '../state/CompilationContext.js'
import { Button } from './Button.js'
import { CommandPalette } from './CommandPalette.js'
import { GainSlider } from './settings/GainSlider.js'

export const Header: FunctionComponent = () => {
  const { program } = useCompilationState()
  const lastProgram = usePrevious(program)

  const engine = useAudioEngine()

  const playing = useObservable(engine.playing)
  const outputGain = useObservable(engine.outputGain)

  const onPlayPause = useCallback(() => {
    if (playing) {
      engine.stop()
    } else if (lastProgram != null) {
      engine.play(lastProgram)
    }
  }, [engine, playing, lastProgram])

  return (
    <header className='grid grid-cols-3 items-center px-2 py-1 gap-1 bg-surface-200 border-b border-b-frame-200'>
      <div className='flex items-center gap-1 h-full'>
        <div className='text-lg font-semibold mr-1'>
          Cadence
        </div>

        <Button onClick={onPlayPause} title={playing ? 'Stop' : 'Play'}>
          {playing ? <StopOutlined /> : <PlayArrowOutlined />}
        </Button>

        <div className='relative h-full w-11'>
          <div className='absolute top-0 left-0 z-20'>
            <GainSlider
              orientation='vertical'
              label='Output gain'
              gain={outputGain}
              onChange={(gain) => engine.outputGain.set(gain)}
              collapsible={true}
            />
          </div>
        </div>
      </div>

      <div className='flex justify-center'>
        <div className='w-full min-w-32 max-w-lg'>
          <CommandPalette />
        </div>
      </div>

      <div />
    </header>
  )
}
