import clsx from 'clsx'
import { FunctionComponent, PropsWithChildren } from 'react'

export const Button: FunctionComponent<PropsWithChildren<{
  onClick?: () => void
  disabled?: boolean
}>> = ({ children, onClick, disabled }) => {
  return (
    <button
      type='button'
      onClick={(event) => {
        event.preventDefault()
        onClick?.()
      }}
      disabled={disabled}
      className={clsx(
        'px-4 py-1 bg-gray-600 text-white rounded cursor-pointer outline-none',
        'enabled:hocus:bg-gray-500',
        'disabled:cursor-default disabled:bg-gray-700 disabled:text-gray-400'
      )}
    >
      {children}
    </button>
  )
}
