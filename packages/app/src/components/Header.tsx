import { PlayArrowOutlined, StopOutlined, VolumeDownOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import { FunctionComponent } from 'react'
import { Button } from './Button.js'
import { Slider } from './Slider.js'
import { makeNumeric, type Numeric } from '@core/program.js'

export const Header: FunctionComponent<{
  playing: boolean
  onPlayPause: () => void
  outputGain: Numeric<'db'>
  onOutputGainChange: (outputGain: Numeric<'db'>) => void
  progress?: number
}> = ({ playing, onPlayPause, outputGain, onOutputGainChange, progress }) => {
  return (
    <header className='w-full border-b border-b-neutral-600 flex flex-wrap items-center px-4 py-1 gap-2'>
      <div className='text-lg font-semibold mr-2'>
        Cadence
      </div>

      <Slider
        label='Output gain'
        min={-60}
        max={0}
        value={outputGain.value}
        onChange={(value) => onOutputGainChange(makeNumeric('db', value))}
        step={1}
        icon={outputGain.value < -48 ? <VolumeOffOutlined /> : outputGain.value < -18 ? <VolumeDownOutlined /> : <VolumeUpOutlined />}
      >
        <span className='w-12 text-right text-nowrap'>
          {`${outputGain.value.toFixed()} dB`}
        </span>
      </Slider>

      <Button onClick={onPlayPause} title={playing ? 'Stop' : 'Play'}>
        {playing ? <StopOutlined /> : <PlayArrowOutlined />}
      </Button>

      {progress != null && (
        <div title='Progress' className='grow min-w-24 max-w-64 flex items-center h-8'>
          <div className='w-full h-2 bg-neutral-600 rounded-xs overflow-hidden'>
            <div
              className='h-full bg-white transition-all duration-100 ease-linear'
              style={{ width: `${(progress * 100).toFixed(2)}%` }}
            />
          </div>
        </div>
      )}
    </header>
  )
}
