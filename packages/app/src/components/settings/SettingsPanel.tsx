import type { FunctionComponent, PropsWithChildren } from 'react'

export const SettingsPanel: FunctionComponent<PropsWithChildren<{
  title?: string
}>> = ({ title, children }) => {
  return (
    <div className='w-full p-4 flex flex-col gap-4 bg-surface-200 rounded border border-frame-100'>
      {title != null && (
        <div className='font-semibold'>
          {title}
        </div>
      )}

      {children}
    </div>
  )
}
