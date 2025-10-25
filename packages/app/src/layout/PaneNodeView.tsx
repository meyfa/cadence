import type { PaneNode } from '@editor/layout.js'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'
import { type FunctionComponent, type ReactNode } from 'react'

export const PaneNodeView: FunctionComponent<{
  node: PaneNode<ReactNode>
}> = ({ node }) => {
  const { tabs, activeTabId } = node

  const defaultTabIndex = tabs.findIndex((tab) => tab.id === activeTabId)

  return (
    <TabGroup className='flex flex-col h-full' defaultIndex={defaultTabIndex >= 0 ? defaultTabIndex : 0}>
      <TabList className='bg-surface-200 border-y border-y-frame-200 flex items-center text-sm font-semibold'>
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            className={({ selected }) => clsx(
              'px-4 h-7 leading-none outline-none border-t-2 enabled:cursor-pointer',
              selected
                ? 'bg-surface-300 border-t-accent-600 dark:border-t-accent-400 text-content-300'
                : 'bg-surface-200 border-t-transparent text-content-200 enabled:hocus:bg-surface-300 enabled:hocus:text-content-300'
            )}
          >
            {tab.title}
            {tab.notificationCount != null && tab.notificationCount > 0 && (
              <span className='inline-block ml-1 px-1.5 py-0.5 text-xs leading-none bg-error-surface text-error-content rounded-full'>
                {tab.notificationCount}
              </span>
            )}
          </Tab>
        ))}
      </TabList>
      <TabPanels className='flex-1 min-h-0 min-w-0'>
        {tabs.map((tab) => (
          <TabPanel key={tab.id} unmount={false} className='h-full w-full relative'>
            {tab.render()}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  )
}
