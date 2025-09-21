import { FunctionComponent, PropsWithChildren } from 'react'

export const Button: FunctionComponent<PropsWithChildren<{
  onClick?: () => void
}>> = ({ children, onClick }) => {
  return (
    <button
      type='button'
      onClick={(event) => {
        event.preventDefault()
        onClick?.()
      }}
      className='px-4 py-1 bg-gray-600 rounded cursor-pointer hocus:bg-gray-500'
    >
      {children}
    </button>
  )
}
