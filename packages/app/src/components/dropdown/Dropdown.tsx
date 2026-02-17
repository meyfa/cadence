import { Select } from '@headlessui/react'
import clsx from 'clsx'
import { useCallback, type ChangeEvent, type FunctionComponent } from 'react'

export interface Option {
  readonly label: string
  readonly value: string
}

export const Dropdown: FunctionComponent<{
  options: readonly Option[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}> = ({ options, value, onChange, disabled }) => {
  const onChangeEvent = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value)
  }, [onChange])

  return (
    <Select
      value={value}
      onChange={onChangeEvent}
      className={clsx(
        'w-full gap-3 px-3 py-1.5 rounded-sm select-none outline-none not-data-disabled:cursor-pointer',
        'bg-surface-200 not-data-disabled:hocus:bg-surface-300',
        'border border-frame-100 not-data-disabled:border-frame-200 not-data-disabled:hocus:border-frame-300',
        'text-content-100 not-data-disabled:text-content-200 not-data-disabled:hocus:text-content-300'
      )}
      disabled={disabled}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </Select>
  )
}
