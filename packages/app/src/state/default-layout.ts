import type { DockLayout, LayoutNodeId, TabId } from '@editor/state/layout.js'
import { TabTypes } from '../panes/render-tab.js'

export const defaultLayout: DockLayout = {
  main: {
    id: 'main-split' as LayoutNodeId,
    type: 'split',
    orientation: 'vertical',
    sizes: [0.8, 0.2],
    children: [
      {
        id: 'main-tabs' as LayoutNodeId,
        type: 'pane',
        tabs: [
          { id: 'editor' as TabId, component: { type: TabTypes.Editor } },
          { id: 'mixer' as TabId, component: { type: TabTypes.Mixer } },
          { id: 'settings' as TabId, component: { type: TabTypes.Settings } }
        ],
        activeTabId: 'editor' as TabId
      },
      {
        id: 'bottom-dock' as LayoutNodeId,
        type: 'pane',
        tabs: [
          { id: 'problems' as TabId, component: { type: TabTypes.Problems } },
          { id: 'timeline' as TabId, component: { type: TabTypes.Timeline } }
        ],
        activeTabId: 'timeline' as TabId
      }
    ]
  }
}
