import { FunctionComponent, PropsWithChildren, type ReactNode } from 'react'
import './Slider.css'

export const Slider: FunctionComponent<PropsWithChildren<{
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  label?: string
  step?: number
  icon?: ReactNode
}>> = ({ children, min, max, value, onChange, label, step, icon }) => {
  return (
    <label
      className='w-full px-2 py-1 h-10 leading-none rounded flex items-center gap-2 border-2 border-neutral-600 text-white select-none'
      title={label}
    >
      {icon}

      <input
        type='range'
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        className='flex-1 min-w-0 cadence-slider'
      />

      {children}
    </label>
  )
}
