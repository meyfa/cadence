import type { ModuleRenderFn, PanelProps, TabTitleProps } from '@editor'
import { Close } from '@mui/icons-material'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'

const isMacOS = (
  'userAgentData' in navigator
    ? ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? '')
    : navigator.userAgent
).toLowerCase().includes('mac')

export const StyledTabTitle: FunctionComponent<Pick<TabTitleProps, 'tab' | 'state' | 'onClose'> & {
  TitleComponent: ModuleRenderFn<PanelProps, string>
  NotificationsComponent: ModuleRenderFn<PanelProps, number | null>
  closeable: boolean
}> = ({ tab, state, onClose, TitleComponent, NotificationsComponent, closeable }) => {
  const dragging = state === 'dragging'
  const focused = state === 'focused' || dragging
  const active = state === 'active' || focused

  const closeButton = closeable && onClose != null && (
    <button
      type='button'
      className={clsx(
        'p-0.5 rounded cursor-default',
        isMacOS ? '-ml-2' : '-mr-2',
        active ? '' : 'opacity-0 enabled:group-hocus:opacity-100',
        focused ? 'text-content-300' : 'text-content-50',
        'enabled:cursor-pointer enabled:hocus:bg-content-100/20 enabled:hocus:text-content-300'
      )}
      onClick={onClose}
      aria-label='Close tab'
    >
      <Close className='text-base!' />
    </button>
  )

  return (
    <div
      className={clsx(
        'group select-none flex items-center gap-2 px-4 h-7 text-sm font-semibold leading-none border-t-2 border-r border-r-surface-100',
        dragging ? 'pointer-events-none' : 'cursor-pointer',
        active
          ? 'bg-surface-300 text-content-300'
          : 'bg-surface-200 text-content-200 hocus:bg-surface-300 hocus:text-content-300',
        focused ? 'border-t-accent-200' : 'border-t-transparent'
      )}
    >
      {isMacOS && closeButton}

      <TitleComponent panelProps={tab.component.props} />

      <div className='px-1 py-0.5 text-xs leading-none bg-error-surface text-error-content border border-error-frame rounded empty:hidden'>
        <NotificationsComponent panelProps={tab.component.props} />
      </div>

      {!isMacOS && closeButton}
    </div>
  )
}
