import { FunctionComponent, PropsWithChildren } from 'react'
import './Slider.css'

export const Slider: FunctionComponent<PropsWithChildren<{
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  label?: string
  step?: number
}>> = ({ children, min, max, value, onChange, label, step }) => {
  return (
    <label
      className='px-3 py-1 h-10 leading-none rounded flex items-center gap-3 border-2 border-gray-600 text-white select-none'
      title={label}
    >
      {children}

      <input
        type='range'
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className='w-32 cadence-slider'
      />
    </label>
  )
}
