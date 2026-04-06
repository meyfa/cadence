import type { DockLayout, LayoutNodeId, TabId } from '../../../src/layout/types.js'

export const rootId = 'root' as LayoutNodeId
export const pane1Id = 'pane1' as LayoutNodeId
export const pane2Id = 'pane2' as LayoutNodeId
export const pane3Id = 'pane3' as LayoutNodeId
export const split1Id = 'split1' as LayoutNodeId

export const tab1Id = 'tab1' as TabId
export const tab2Id = 'tab2' as TabId
export const tab3Id = 'tab3' as TabId
export const tab4Id = 'tab4' as TabId

export const testLayout: DockLayout = {
  main: {
    id: rootId,
    type: 'split',
    orientation: 'horizontal',
    sizes: [0.25, 0.75],
    children: [
      {
        id: pane1Id,
        type: 'pane',
        activeTabId: tab1Id,
        tabs: [
          { id: tab1Id, component: { type: 'ComponentA' } },
          { id: tab2Id, component: { type: 'ComponentB' } }
        ]
      },
      {
        id: split1Id,
        type: 'split',
        orientation: 'vertical',
        sizes: [0.5, 0.5],
        children: [
          {
            id: pane2Id,
            type: 'pane',
            activeTabId: tab3Id,
            tabs: [
              { id: tab3Id, component: { type: 'ComponentC' } }
            ]
          },
          {
            id: pane3Id,
            type: 'pane',
            activeTabId: tab4Id,
            tabs: [
              { id: tab4Id, component: { type: 'ComponentD' } }
            ]
          }
        ]
      }
    ]
  },
  focusedTabId: tab1Id
}
