import { FunctionComponent } from 'react'
import { Button } from './Button.js'
import { Slider } from './Slider.js'

export const Header: FunctionComponent<{
  playing: boolean
  onPlayPause: () => void
  volume: number
  onVolumeChange: (volume: number) => void
  onUpdate: () => void
}> = ({ playing, onPlayPause, volume, onVolumeChange, onUpdate }) => {
  return (
    <header className='w-full h-12 border-b border-b-gray-700 flex items-center px-4 gap-4'>
      <h1 className='text-lg font-semibold'>
        Cadence
      </h1>

      <div className='grow flex justify-end items-center gap-4'>
        <label className='flex gap-2'>
          Volume
          <Slider min={0} max={100} value={volume} onChange={onVolumeChange} />
        </label>

        <Button onClick={onPlayPause}>
          {playing ? 'Stop' : 'Play'}
        </Button>

        <Button onClick={onUpdate} disabled={!playing}>
          Update
        </Button>
      </div>
    </header>
  )
}
