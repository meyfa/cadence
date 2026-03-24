import { TabPanel } from '@headlessui/react'
import type { ComponentType, FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import type { Tab as LayoutTab } from '../types.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'

export interface TabContentProps {
  readonly tab: LayoutTab
}

export const TabContent: FunctionComponent<TabContentProps & {
  TabContentComponent: ComponentType<TabContentProps>
  FallbackComponent: ComponentType<FallbackProps>
}> = ({ TabContentComponent, FallbackComponent, tab }) => {
  return (
    <TabPanel unmount={false} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PanelErrorBoundary FallbackComponent={FallbackComponent}>
        <TabContentComponent tab={tab} />
      </PanelErrorBoundary>
    </TabPanel>
  )
}
