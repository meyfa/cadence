import type { FunctionComponent, PropsWithChildren } from 'react'

export const Footer: FunctionComponent<PropsWithChildren> = ({ children }) => {
  return (
    <footer className='flex px-4 py-1 gap-2 text-sm text-neutral-400 border-t border-t-neutral-700 items-start'>
      {children}
    </footer>
  )
}
