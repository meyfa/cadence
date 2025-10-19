import { PlayArrowOutlined, StopOutlined, VolumeDownOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import { FunctionComponent } from 'react'
import { Button } from './Button.js'
import { Slider } from './Slider.js'

export const Header: FunctionComponent<{
  playing: boolean
  onPlayPause: () => void
  volume: number
  onVolumeChange: (volume: number) => void
  progress?: number
}> = ({ playing, onPlayPause, volume, onVolumeChange, progress }) => {
  return (
    <header className='w-full border-b border-b-neutral-600 flex flex-wrap items-center px-4 py-1 gap-2'>
      <div className='text-lg font-semibold mr-2'>
        Cadence
      </div>

      <Slider label='Volume' min={0} max={1} value={volume} onChange={onVolumeChange} step={0.02}>
        {volume < 0.1 ? <VolumeOffOutlined /> : volume > 0.5 ? <VolumeUpOutlined /> : <VolumeDownOutlined />}
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
