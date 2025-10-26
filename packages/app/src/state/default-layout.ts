import type { DockLayout } from '@editor/state/layout.js'
import { TabTypes } from '../panes/render-tab.js'

export const defaultLayout: DockLayout = {
  main: {
    id: 'main-split',
    type: 'split',
    direction: 'vertical',
    sizes: [0.8, 0.2],
    children: [
      {
        id: 'main-tabs',
        type: 'pane',
        tabs: [
          { id: 'editor', component: { type: TabTypes.Editor } },
          { id: 'mixer', component: { type: TabTypes.Mixer } },
          { id: 'settings', component: { type: TabTypes.Settings } }
        ],
        activeTabId: 'editor'
      },
      {
        id: 'bottom-dock',
        type: 'pane',
        tabs: [
          { id: 'problems', component: { type: TabTypes.Problems } },
          { id: 'timeline', component: { type: TabTypes.Timeline } }
        ],
        activeTabId: 'timeline'
      }
    ]
  }
}
