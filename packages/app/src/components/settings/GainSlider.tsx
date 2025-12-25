import { makeNumeric, type Numeric } from '@core/program.js'
import type { FunctionComponent } from 'react'
import { Slider } from '../Slider.js'
import { GainIcon } from './GainIcon.js'
import clsx from 'clsx'

export const GainSlider: FunctionComponent<{
  gain: Numeric<'db'>
  onChange: (gain: Numeric<'db'>) => void
  label: string
  orientation?: 'horizontal' | 'vertical'
  collapsible?: boolean
}> = ({ gain, onChange, label, orientation, collapsible }) => {
  return (
    <Slider
      label={label}
      orientation={orientation}
      min={-60}
      max={0}
      value={gain.value}
      onChange={(value) => onChange(makeNumeric('db', value))}
      step={1}
      icon={<GainIcon gain={gain} />}
      collapsible={collapsible}
    >
      <span
        className={clsx(
          'text-right text-nowrap',
          orientation === 'vertical' ? 'text-sm' : 'w-12'
        )}
      >
        {gain.value.toFixed()}
        {orientation === 'vertical' ? null : ' dB'}
      </span>
    </Slider>
  )
}
