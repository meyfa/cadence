import type { PaneNode, SerializedComponent } from '@editor/state/layout.js'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'
import { useCallback, type FunctionComponent } from 'react'
import { renderTabComponent, renderTabNotificationCount, renderTabTitle, type TabRendererContext } from '../panes/render-tab.js'
import type { LayoutNodeDispatch } from '../state/LayoutContext.js'

export const PaneNodeView: FunctionComponent<{
  node: PaneNode
  dispatch: LayoutNodeDispatch
  tabRendererContext: TabRendererContext
}> = ({ node, dispatch, tabRendererContext }) => {
  const { tabs, activeTabId } = node

  const selectedIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  const onSelectionChange = useCallback((index: number) => {
    const selectedTab = tabs.at(index)
    if (selectedTab != null) {
      dispatch((node) => {
        if (node.type !== 'pane') {
          return node
        }

        return { ...node, activeTabId: selectedTab.id }
      })
    }
  }, [dispatch, tabs])

  return (
    <TabGroup
      className='flex flex-col h-full'
      selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
      onChange={onSelectionChange}
    >
      <TabList className='bg-surface-200 border-y border-y-frame-200 flex items-center text-sm font-semibold'>
        {tabs.map((tab) => (
          <TabTitle key={tab.id} component={tab.component} context={tabRendererContext} />
        ))}
      </TabList>
      <TabPanels className='flex-1 min-h-0 min-w-0'>
        {tabs.map((tab) => (
          <TabContent key={tab.id} component={tab.component} context={tabRendererContext} />
        ))}
      </TabPanels>
    </TabGroup>
  )
}

const TabTitle: FunctionComponent<{
  component: SerializedComponent
  context: TabRendererContext
}> = ({ component, context }) => {
  const title = renderTabTitle(component, context)
  const notificationCount = renderTabNotificationCount(component, context)

  return (
    <Tab
      className={({ selected }) => clsx(
        'px-4 h-7 leading-none outline-none border-t-2 enabled:cursor-pointer',
        selected
          ? 'bg-surface-300 border-t-accent-600 dark:border-t-accent-400 text-content-300'
          : 'bg-surface-200 border-t-transparent text-content-200 enabled:hocus:bg-surface-300 enabled:hocus:text-content-300'
      )}
    >
      {title}

      {notificationCount > 0 && (
        <span className='inline-block ml-1 px-1.5 py-0.5 text-xs leading-none bg-error-surface text-error-content rounded-full'>
          {notificationCount}
        </span>
      )}
    </Tab>
  )
}

const TabContent: FunctionComponent<{
  component: SerializedComponent
  context: TabRendererContext
}> = ({ component, context }) => {
  return (
    <TabPanel unmount={false} className='h-full w-full relative'>
      {renderTabComponent(component, context)}
    </TabPanel>
  )
}
