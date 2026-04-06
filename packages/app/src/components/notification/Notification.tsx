import type { NotificationComponentProps } from '@editor'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'

type NotificationSeverity = 'info' | 'error'

export const Notification: FunctionComponent<NotificationComponentProps & {
  severity: NotificationSeverity
  message: string
}> = ({ duplicates, severity, message }) => {
  return (
    <div
      className={clsx(
        'mx-4 my-2 px-4 py-2 rounded border shadow',
        severity === 'info' && 'bg-surface-100 text-content-100 border-frame-100',
        severity === 'error' && 'bg-error-surface text-error-content border-error-frame'
      )}
      role='alert'
    >
      {message}

      {duplicates > 0 && (
        <div className='mt-1 text-right text-sm text-content-300'>
          +{duplicates} more
        </div>
      )}
    </div>
  )
}
