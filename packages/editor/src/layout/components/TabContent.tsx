import { TabPanel } from '@headlessui/react'
import { useEffect, useRef, type ComponentType, type FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import { updateFocusedTab } from '../algorithms.js'
import type { Tab as LayoutTab } from '../types.js'
import type { LayoutDispatch } from './LayoutContext.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'

export interface TabContentProps {
  readonly tab: LayoutTab
}

export const TabContent: FunctionComponent<TabContentProps & {
  TabContentComponent: ComponentType<TabContentProps>
  FallbackComponent: ComponentType<FallbackProps>
  dispatch?: LayoutDispatch
}> = ({ TabContentComponent, FallbackComponent, tab, dispatch }) => {
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (panel == null) {
      return
    }

    const listener = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && panel.contains(event.target)) {
        dispatch?.((layout) => updateFocusedTab(layout, tab.id))
      }
    }

    panel.addEventListener('focusin', listener)

    return () => {
      panel.removeEventListener('focusin', listener)
    }
  }, [dispatch, tab.id])

  return (
    <TabPanel unmount={false} style={{ position: 'relative', width: '100%', height: '100%' }} ref={panelRef}>
      <PanelErrorBoundary FallbackComponent={FallbackComponent}>
        <TabContentComponent tab={tab} />
      </PanelErrorBoundary>
    </TabPanel>
  )
}
