import type { DockLayout, LayoutNodeId, TabId } from '@editor'
import { editorPanelId } from '../modules/editor/index.js'
import type { EditorPanelProps } from '../modules/editor/panel-props.js'
import { mixerPanelId } from '../modules/mixer/index.js'
import { timelinePanelId } from '../modules/playback/index.js'
import { problemsPanelId } from '../modules/problems/index.js'
import { TRACK_FILE_PATH } from '../persistence/constants.js'
import { settingsPanelId } from '../modules/settings/index.js'

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
          {
            id: 'editor' as TabId,
            component: {
              type: editorPanelId,
              props: { filePath: TRACK_FILE_PATH } satisfies EditorPanelProps
            }
          },
          {
            id: 'mixer' as TabId,
            component: {
              type: mixerPanelId
            }
          },
          {
            id: 'settings' as TabId,
            component: {
              type: settingsPanelId
            }
          }
        ],
        activeTabId: 'editor' as TabId
      },
      {
        id: 'bottom-dock' as LayoutNodeId,
        type: 'pane',
        tabs: [
          {
            id: 'problems' as TabId,
            component: {
              type: problemsPanelId
            }
          },
          {
            id: 'timeline' as TabId,
            component: {
              type: timelinePanelId
            }
          }
        ],
        activeTabId: 'timeline' as TabId
      }
    ]
  },
  focusedTabId: 'editor' as TabId
}
