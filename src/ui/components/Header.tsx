import { FunctionComponent } from 'react'
import { Button } from './Button.js'
import { Slider } from './Slider.js'
import { PlayArrowOutlined, StopOutlined, VolumeDownOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import clsx from 'clsx'

export const Header: FunctionComponent<{
  playing: boolean
  onPlayPause: () => void
  volume: number
  onVolumeChange: (volume: number) => void
}> = ({ playing, onPlayPause, volume, onVolumeChange }) => {
  return (
    <header className={clsx(
      'w-full border-b border-b-gray-700 flex flex-col items-center px-4 py-2 gap-2',
      'sm:flex-row sm:gap-4'
    )}
    >
      <h1 className='text-lg font-semibold'>
        Cadence
      </h1>

      <div className='grow flex items-center gap-4'>
        <Button onClick={onPlayPause} title={playing ? 'Stop' : 'Play'}>
          {playing ? <StopOutlined /> : <PlayArrowOutlined />}
        </Button>

        <Slider label='Volume' min={0} max={1} value={volume} onChange={onVolumeChange} step={0.02}>
          {volume < 0.1 ? <VolumeOffOutlined /> : volume > 0.5 ? <VolumeUpOutlined /> : <VolumeDownOutlined />}
        </Slider>
      </div>
    </header>
  )
}
