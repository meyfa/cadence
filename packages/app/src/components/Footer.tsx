import type { FunctionComponent, PropsWithChildren } from 'react'

export const Footer: FunctionComponent<PropsWithChildren> = ({ children }) => {
  return (
    <footer className='flex px-4 py-1 gap-2 text-sm text-content-200 border-t border-t-frame-100 items-start'>
      {children}
    </footer>
  )
}
