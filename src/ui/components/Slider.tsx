import { FunctionComponent, PropsWithChildren } from 'react'

export const Slider: FunctionComponent<PropsWithChildren<{
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}>> = ({ min, max, value, onChange }) => {
  return (
    <input
      type='range'
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      className='w-32'
    />
  )
}
