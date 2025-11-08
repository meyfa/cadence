import type { Tab } from '@editor/state/layout.js'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'
import { renderTabNotificationCount, renderTabTitle, type TabRendererContext } from '../panes/render-tab.js'

export const TabComponent: FunctionComponent<{
  tab: Tab
  context: TabRendererContext
  disabled?: boolean
  selected?: boolean
}> = ({ tab, context, disabled, selected }) => {
  const title = renderTabTitle(tab.component, context)
  const notificationCount = renderTabNotificationCount(tab.component, context)

  // Mirror the selected tab appearance; ensure it's outside hit-testing
  return (
    <div
      className={clsx(
        'select-none flex items-center gap-2 px-4 h-7 text-sm font-semibold leading-none border-t-2 border-r border-r-surface-100',
        disabled ? 'pointer-events-none' : 'cursor-pointer',
        selected
          ? 'bg-surface-300 border-t-accent-600 dark:border-t-accent-400 text-content-300'
          : 'bg-surface-200 border-t-transparent text-content-200 hocus:bg-surface-300 hocus:text-content-300'
      )}
    >
      {title}

      {notificationCount > 0 && (
        <div className='px-1.5 py-0.5 text-xs leading-none bg-error-surface text-error-content rounded-full'>
          {notificationCount}
        </div>
      )}
    </div>
  )
}
