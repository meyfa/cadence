import { useCommandRegistry, useObservable, type CommandId } from '@editor'
import { PlayArrowOutlined, StopOutlined } from '@mui/icons-material'
import type { FunctionComponent } from 'react'
import { Button } from '../../../components/button/Button.js'
import { GainSlider } from '../../../components/gain-slider/GainSlider.js'
import { useAudioEngine } from '../provider.js'

export const PlaybackControls: FunctionComponent = () => {
  const engine = useAudioEngine()

  const playing = useObservable(engine.playing)
  const outputGain = useObservable(engine.outputGain)

  const { getCommandById } = useCommandRegistry()
  const togglePlaybackCommand = getCommandById('playback.toggle' as CommandId)

  return (
    <>
      <Button
        title={playing ? 'Stop' : 'Play'}
        disabled={togglePlaybackCommand == null}
        onClick={() => togglePlaybackCommand?.run()}
      >
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
