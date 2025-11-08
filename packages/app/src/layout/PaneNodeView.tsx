import type { Tab as LayoutTab, PaneNode, SerializedComponent } from '@editor/state/layout.js'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useCallback, type FunctionComponent } from 'react'
import { TabComponent } from '../components/TabComponent.js'
import { renderTabContent, type TabRendererContext } from '../panes/render-tab.js'
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
          <TabTitle key={tab.id} tab={tab} context={tabRendererContext} />
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
  tab: LayoutTab
  context: TabRendererContext
}> = ({ tab, context }) => {
  return (
    <Tab className='outline-none'>
      {({ disabled, selected }) => (
        <TabComponent tab={tab} context={context} disabled={disabled} selected={selected} />
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
      {renderTabContent(component, context)}
    </TabPanel>
  )
}
