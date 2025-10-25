import { Radio as HUIRadio } from '@headlessui/react'
import clsx from 'clsx'
import type { FunctionComponent, PropsWithChildren } from 'react'

export const Radio: FunctionComponent<PropsWithChildren<{
  value: string
  disabled?: boolean
}>> = ({ value, disabled, children }) => {
  return (
    <HUIRadio
      value={value}
      className={clsx(
        'group flex items-center gap-4 px-4 py-2 rounded-sm select-none enabled:cursor-pointer',
        'bg-neutral-700 data-checked:bg-neutral-600 enabled:hocus:bg-neutral-600',
        'border border-neutral-600 data-checked:border-neutral-400 enabled:hocus:border-neutral-400',
        'text-neutral-500 enabled:text-neutral-300 data-checked:text-white enabled:hocus:text-white'
      )}
      disabled={disabled}
    >
      <div className='w-5 h-5 border border-current rounded-full flex items-center justify-center'>
        <div className='w-3 h-3 rounded-full bg-transparent group-data-checked:bg-current' />
      </div>

      <div>
        {children}
      </div>
    </HUIRadio>
  )
}
