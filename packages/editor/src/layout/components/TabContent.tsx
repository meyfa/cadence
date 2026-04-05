import { TabPanel } from '@headlessui/react'
import { useEffect, useRef, type ComponentType, type FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { updateFocusedTab } from '../algorithms.js'
import type { Tab as LayoutTab } from '../types.js'
import { useLayout } from './LayoutContext.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'

export interface TabContentProps {
  readonly tab: LayoutTab
}

export const TabContent: FunctionComponent<TabContentProps & {
  TabContentComponent: ComponentType<TabContentProps>
  FallbackComponent: ComponentType<FallbackProps>
}> = ({ TabContentComponent, FallbackComponent, tab }) => {
  const [, layoutDispatch] = useLayout()

  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (panel == null) {
      return
    }

    const listener = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && panel.contains(event.target)) {
        layoutDispatch((layout) => updateFocusedTab(layout, tab.id))
      }
    }

    panel.addEventListener('focusin', listener)

    return () => {
      panel.removeEventListener('focusin', listener)
    }
  }, [layoutDispatch, tab.id])

  return (
    <TabPanel unmount={false} style={{ position: 'relative', width: '100%', height: '100%' }} ref={panelRef}>
      <PanelErrorBoundary FallbackComponent={FallbackComponent}>
        <TabContentComponent tab={tab} />
      </PanelErrorBoundary>
    </TabPanel>
  )
}
