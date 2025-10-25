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
        'px-3 py-1 h-10 leading-none text-nowrap bg-neutral-600 border border-transparent text-white rounded cursor-pointer outline-none',
        'enabled:hocus:bg-neutral-600 enabled:hocus:border-neutral-400',
        'disabled:cursor-default disabled:bg-neutral-700 disabled:text-neutral-400'
      )}
    >
      {children}
    </button>
  )
}
