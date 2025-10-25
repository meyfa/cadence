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
      <TabList className='border-y border-y-neutral-700 bg-neutral-800 flex items-center text-sm font-semibold'>
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            className={({ selected }) => clsx(
              'px-4 h-7 leading-none outline-none bg-neutral-600 border-t enabled:cursor-pointer',
              selected
                ? 'bg-neutral-700 border-t-blue-400 text-white'
                : 'bg-neutral-800 border-t-transparent text-neutral-300 enabled:hocus:bg-neutral-700 enabled:hocus:text-white'
            )}
          >
            {tab.title}
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
