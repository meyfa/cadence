import clsx from 'clsx'
import type { FunctionComponent } from 'react'
import './ProgressBar.css'

export const ProgressBar: FunctionComponent<{
  disabled?: boolean
  progress?: number
}> = ({ disabled, progress }) => {
  if (disabled === true || progress == null) {
    return (
      <div
        className='h-2 bg-surface-300 rounded-xs overflow-hidden relative'
      >
        <div
          key='indeterminate'
          className={clsx(
            'h-full bg-accent-100 rounded-xs w-1/3 absolute left-0 top-0 bottom-0',
            disabled === true ? 'opacity-0' : 'indeterminate-progress-bar-animate'
          )}
        />
      </div>
    )
  }

  return (
    <div
      className='h-2 bg-surface-300 rounded-xs overflow-hidden'
    >
      <div
        key='determinate'
        className='h-full bg-accent-100 rounded-xs transition-[width] duration-300 ease-out'
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  )
}
