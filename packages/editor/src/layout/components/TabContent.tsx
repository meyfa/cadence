import { TabPanel } from '@headlessui/react'
import { useEffect, useRef, type ComponentType, type FunctionComponent } from 'react'
import type { FallbackProps } from 'react-error-boundary'
import type { PanelId } from '../../modules/types.js'
import { updateFocusedTab } from '../algorithms/mutate.js'
import type { Tab as LayoutTab } from '../types.js'
import type { LayoutDispatch } from './LayoutContext.js'
import { PanelErrorBoundary } from './PanelErrorBoundary.js'
import { usePanelById } from './panel-lookup.js'

export interface TabContentProps {
  readonly tab: LayoutTab
}

export const TabContent: FunctionComponent<TabContentProps & {
  FallbackComponent: ComponentType<FallbackProps>
  dispatch?: LayoutDispatch
}> = ({ FallbackComponent, tab, dispatch }) => {
  const panel = usePanelById(tab.component.type as PanelId)
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
        {panel == null
          ? `Unknown tab type: ${tab.component.type}`
          : <panel.Panel panelProps={tab.component.props} tabId={tab.id} />}
      </PanelErrorBoundary>
    </TabPanel>
  )
}
