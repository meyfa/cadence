import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { EditorPanel } from './EditorPanel.js'

export const editorModuleId = 'editor' as AppModuleId
export const editorPanelId = `${editorModuleId}.editor` as AppModulePanelId

export const editorModule: AppModule = {
  id: editorModuleId,
  panels: [
    {
      id: editorPanelId,
      component: EditorPanel,
      closable: false,
      title: () => 'Editor',
      notificationCount: () => 0
    }
  ]
}
