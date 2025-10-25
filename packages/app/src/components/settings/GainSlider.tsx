import { makeNumeric, type Numeric } from '@core/program.js'
import { VolumeDownOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import type { FunctionComponent } from 'react'
import { Slider } from '../Slider.js'

export const GainSlider: FunctionComponent<{
  gain: Numeric<'db'>
  onChange: (gain: Numeric<'db'>) => void
  label: string
}> = ({ gain, onChange, label }) => {
  return (
    <Slider
      label={label}
      min={-60}
      max={0}
      value={gain.value}
      onChange={(value) => onChange(makeNumeric('db', value))}
      step={1}
      icon={gain.value < -48 ? <VolumeOffOutlined /> : gain.value < -18 ? <VolumeDownOutlined /> : <VolumeUpOutlined />}
    >
      <span className='w-12 text-right text-nowrap'>
        {`${gain.value.toFixed()} dB`}
      </span>
    </Slider>
  )
}
