import type { PanelProps } from '@editor'
import { object, string } from 'superstruct'

export interface EditorPanelProps {
  readonly filePath: string
}

const editorPanelPropsStruct = object({
  filePath: string()
})

export function getEditorPanelProps (panelProps: PanelProps['panelProps']): EditorPanelProps {
  return editorPanelPropsStruct.create(panelProps)
}
