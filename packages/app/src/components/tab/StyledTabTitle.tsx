import { Close } from '@mui/icons-material'
import clsx from 'clsx'
import { type FunctionComponent } from 'react'

const isMacOS = (
  'userAgentData' in navigator
    ? ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '')
    : navigator.userAgent
).toLowerCase().includes('mac')

export const StyledTabTitle: FunctionComponent<{
  title: string
  notifications: number
  closeable: boolean
  disabled?: boolean
  selected?: boolean
  onClose?: () => void
}> = ({ title, notifications, closeable, disabled, selected, onClose }) => {
  const closeButton = closeable && onClose != null
    ? (
        <button
          type='button'
          className={clsx(
            'p-0.5 rounded text-content-50 cursor-default',
            isMacOS ? '-ml-2' : '-mr-2',
            selected ? '' : 'opacity-0 enabled:group-hocus:opacity-100',
            'enabled:cursor-pointer enabled:hocus:bg-content-100/20 enabled:hocus:text-content-300'
          )}
          onClick={onClose}
          aria-label='Close tab'
        >
          <Close className='text-base!' />
        </button>
      )
    : null

  return (
    <div
      className={clsx(
        'group select-none flex items-center gap-2 px-4 h-7 text-sm font-semibold leading-none border-t-2 border-r border-r-surface-100',
        disabled ? 'pointer-events-none' : 'cursor-pointer',
        selected
          ? 'bg-surface-300 border-t-accent-200 text-content-300'
          : 'bg-surface-200 border-t-transparent text-content-200 hocus:bg-surface-300 hocus:text-content-300'
      )}
    >
      {isMacOS && closeButton}

      {title}

      {notifications > 0 && (
        <div className='px-1 py-0.5 text-xs leading-none bg-error-surface text-error-content rounded'>
          {notifications}
        </div>
      )}

      {!isMacOS && closeButton}
    </div>
  )
}
