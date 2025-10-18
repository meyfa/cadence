import { TabGroup, TabList, TabPanels, TabPanel, Tab } from '@headlessui/react'
import clsx from 'clsx'
import { Fragment, type FunctionComponent } from 'react'

export interface TabProps {
  readonly title: string
  readonly render: () => React.ReactNode
}

export const TabLayout: FunctionComponent<{
  tabs: readonly TabProps[]
}> = ({ tabs }) => {
  return (
    <TabGroup className='flex-1 min-h-0 min-w-0 flex flex-col'>
      <TabList className='border-b border-b-gray-700 flex items-center'>
        {tabs.map((tab, index) => (
          <Tab
            key={index}
            className={({ selected }) => clsx(
              'px-4 h-8 leading-none text-white outline-none bg-gray-600 border-y-1 border-y-transparent enabled:cursor-pointer',
              selected ? 'bg-gray-700 border-t-blue-400' : 'bg-gray-800 enabled:hocus:bg-gray-700 border-t-transparent'
            )}
          >
            {tab.title}
          </Tab>
        ))}
      </TabList>
      <TabPanels className='flex-1 min-h-0 min-w-0'>
        {tabs.map((tab, index) => (
          <TabPanel key={index} as={Fragment}>
            {tab.render()}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  )
}
