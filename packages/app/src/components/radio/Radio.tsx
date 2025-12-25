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
        'group flex items-center gap-3 px-3 py-1 rounded-sm select-none not-data-disabled:cursor-pointer',
        'bg-surface-200 data-checked:bg-surface-300 not-data-disabled:hocus:bg-surface-300',
        'border border-frame-200 data-checked:border-frame-300 not-data-disabled:hocus:border-frame-300',
        'text-content-100 not-data-disabled:text-content-200 data-checked:text-content-300 not-data-disabled:hocus:text-content-300'
      )}
      disabled={disabled}
    >
      <div className='w-4 h-4 border border-current rounded-full flex items-center justify-center'>
        <div className='w-2.5 h-2.5 rounded-full bg-transparent group-data-checked:bg-current' />
      </div>

      <div>
        {children}
      </div>
    </HUIRadio>
  )
}
