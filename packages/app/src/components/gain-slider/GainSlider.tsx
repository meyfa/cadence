import type { Numeric } from '@meyfa/cadence-utility'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'
import { Slider } from '../slider/Slider.js'
import { GainIcon } from './GainIcon.js'

export const GainSlider: FunctionComponent<{
  gain: Numeric<'db'>
  onChange: (gain: Numeric<'db'>) => void
  label: string
  orientation?: 'horizontal' | 'vertical'
  collapsible?: boolean
}> = ({ gain, onChange, label, orientation, collapsible }) => {
  const vertical = orientation === 'vertical'

  return (
    <Slider
      label={label}
      orientation={orientation}
      min={-60}
      max={0}
      value={gain}
      onChange={(value) => onChange(value as Numeric<'db'>)}
      step={1}
      icon={<GainIcon gain={gain} />}
      collapsible={collapsible}
    >
      <span className={clsx('text-right text-nowrap', vertical ? 'text-sm' : 'w-12')}>
        {gain.toFixed() + (vertical ? '' : ' dB')}
      </span>
    </Slider>
  )
}
