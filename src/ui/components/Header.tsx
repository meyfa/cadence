import { FunctionComponent } from 'react'
import { Button } from './Button.js'
import { Slider } from './Slider.js'
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
        <Button onClick={onPlayPause}>
          {playing ? 'Stop' : 'Play'}
        </Button>

        <label className='flex gap-2'>
          Volume
          <Slider min={0} max={1} value={volume} onChange={onVolumeChange} />
        </label>
      </div>
    </header>
  )
}
