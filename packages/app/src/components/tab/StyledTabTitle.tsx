import type { TabTitleProps, TabTitleState } from '@meyfa/cadence-editor'
import { Close } from '@mui/icons-material'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'
import { isCoarsePointer, isMacOS } from '../../utilities/features.ts'

const draggingStates: ReadonlySet<TabTitleState> = new Set(['dragging'])
const focusedStates: ReadonlySet<TabTitleState> = new Set(['dragging', 'focused'])
const activeStates: ReadonlySet<TabTitleState> = new Set(['dragging', 'focused', 'active'])

export const StyledTabTitle: FunctionComponent<TabTitleProps> = ({
  tab,
  state,
  onClose,
  TitleComponent,
  NotificationsComponent,
  closeable
}) => {
  const dragging = draggingStates.has(state)
  const focused = focusedStates.has(state)
  const active = activeStates.has(state)

  const macOS = isMacOS()

  const closeButton = closeable && onClose != null && (
    <TabCloseButton
      focused={focused}
      active={active}
      onClose={onClose}
      className={macOS ? '-ml-2' : '-mr-2'}
    />
  )

  return (
    <div
      className={clsx(
        'group select-none flex items-center gap-2 px-4 h-7 text-sm font-semibold leading-none border-t-2 border-r border-r-surface-100',
        dragging
          ? 'pointer-events-none'
          : 'cursor-pointer',
        focused
          ? 'border-t-accent-200'
          : 'border-t-transparent',
        active
          ? 'bg-surface-300 text-content-300'
          : 'bg-surface-200 text-content-200 hocus:bg-surface-300 hocus:text-content-300'
      )}
    >
      {macOS && closeButton}
      <TitleComponent panelProps={tab.component.props} tabId={tab.id} />
      <NotificationsComponent panelProps={tab.component.props} tabId={tab.id} />
      {!macOS && closeButton}
    </div>
  )
}

const TabCloseButton: FunctionComponent<{
  focused: boolean
  active: boolean
  onClose: () => void
  className?: string
}> = ({ focused, active, onClose, className }) => {
  const coarsePointer = isCoarsePointer()

  return (
    <button
      type='button'
      aria-label='Close tab'
      onClick={onClose}
      className={clsx(
        'shrink-0 p-0.5 rounded cursor-pointer hocus:bg-content-100/20 hocus:text-content-300',
        focused
          ? 'text-content-300'
          : 'text-content-50',
        active
          ? ''
          : (coarsePointer ? 'invisible' : 'opacity-0 group-hocus:opacity-100'),
        className
      )}
    >
      <Close className='text-base!' />
    </button>
  )
}
