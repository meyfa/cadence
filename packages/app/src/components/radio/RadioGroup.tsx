import type { FunctionComponent, PropsWithChildren } from 'react'
import { RadioGroup as HUIRadioGroup } from '@headlessui/react'

export const RadioGroup: FunctionComponent<PropsWithChildren<{
  value: string
  onChange: (value: string) => void
}>> = ({ value, onChange, children }) => {
  return (
    <HUIRadioGroup
      value={value}
      onChange={onChange}
      className='flex flex-col gap-2'
    >
      {children}
    </HUIRadioGroup>
  )
}
