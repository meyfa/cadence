import type { DockLayout, EditorLocation, PanelId } from '@meyfa/cadence-editor'
import { findFocusedTab } from '@meyfa/cadence-editor'
import { getEditorPanelProps } from './panel-props.ts'
import type { EditorState } from './provider.ts'

export function getFocusedEditorFilePath (layout: DockLayout, panelId: PanelId): string | undefined {
  const tab = findFocusedTab(layout)
  if (tab?.component.type !== panelId) {
    return undefined
  }

  try {
    return getEditorPanelProps(tab.component.props).filePath
  } catch {
    return undefined
  }
}

export function getFocusedEditorCaret (
  layout: DockLayout,
  panelId: PanelId,
  carets: EditorState['carets']
): EditorLocation | undefined {
  const tab = findFocusedTab(layout)
  return tab?.component.type === panelId ? carets[tab.id] : undefined
}
