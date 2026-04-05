import { createAudioGraph } from '@audiograph'
import { PlayArrowOutlined, StopOutlined } from '@mui/icons-material'
import { useCallback, type FunctionComponent } from 'react'
import { Button } from '../../components/button/Button.js'
import { GainSlider } from '../../components/gain-slider/GainSlider.js'
import { useObservable } from '../../hooks/observable.js'
import { usePrevious } from '../../hooks/previous.js'
import { useAudioEngine } from '../../components/contexts/AudioEngineContext.js'
import { useCompilationState } from '../../components/contexts/CompilationContext.js'

export const PlaybackControls: FunctionComponent = () => {
  const { program } = useCompilationState()
  const lastProgram = usePrevious(program)

  const engine = useAudioEngine()

  const playing = useObservable(engine.playing)
  const outputGain = useObservable(engine.outputGain)

  const onPlayPause = useCallback(() => {
    if (playing) {
      engine.stop()
    } else if (lastProgram != null) {
      engine.play(createAudioGraph(lastProgram))
    }
  }, [engine, playing, lastProgram])

  return (
    <>
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
    </>
  )
}
