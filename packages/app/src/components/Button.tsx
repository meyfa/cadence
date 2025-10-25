import clsx from 'clsx'
import { FunctionComponent, PropsWithChildren } from 'react'

export const Button: FunctionComponent<PropsWithChildren<{
  onClick?: () => void
  disabled?: boolean
  title?: string
}>> = ({ children, onClick, disabled, title }) => {
  return (
    <button
      type='button'
      onClick={(event) => {
        event.preventDefault()
        onClick?.()
      }}
      disabled={disabled}
      title={title}
      className={clsx(
        'px-3 py-1 h-10 leading-none text-nowrap rounded outline-none border',
        'bg-surface-100 enabled:bg-surface-200 enabled:hocus:bg-surface-300',
        'text-content-100 enabled:text-content-200 enabled:hocus:text-content-300',
        'border-transparent enabled:border-frame-200 enabled:hocus:border-frame-300',
        'cursor-default enabled:cursor-pointer'
      )}
    >
      {children}
    </button>
  )
}
