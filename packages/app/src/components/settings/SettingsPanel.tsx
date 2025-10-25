import type { FunctionComponent, PropsWithChildren } from 'react'

export const SettingsPanel: FunctionComponent<PropsWithChildren<{
  title?: string
}>> = ({ title, children }) => {
  return (
    <div className='w-full p-4 flex flex-col gap-4 bg-neutral-800 rounded border border-neutral-500'>
      {title != null && (
        <div className='font-semibold'>
          {title}
        </div>
      )}

      {children}
    </div>
  )
}
