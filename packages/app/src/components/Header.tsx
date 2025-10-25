import { type Numeric } from '@core/program.js'
import { PlayArrowOutlined, StopOutlined } from '@mui/icons-material'
import { FunctionComponent } from 'react'
import { Button } from './Button.js'
import { GainSlider } from './settings/GainSlider.js'

export const Header: FunctionComponent<{
  playing: boolean
  onPlayPause: () => void
  outputGain: Numeric<'db'>
  onOutputGainChange: (outputGain: Numeric<'db'>) => void
  progress?: number
}> = ({ playing, onPlayPause, outputGain, onOutputGainChange, progress }) => {
  return (
    <header className='flex flex-wrap items-center px-4 py-1 gap-2'>
      <div className='text-lg font-semibold mr-2'>
        Cadence
      </div>

      <div className='w-56'>
        <GainSlider label='Output gain' gain={outputGain} onChange={onOutputGainChange} />
      </div>

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
