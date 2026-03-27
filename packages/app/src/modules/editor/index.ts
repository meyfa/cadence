import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { EditorPanel } from './EditorPanel.js'

const moduleId = 'editor' as AppModuleId
export const editorPanelId = `${moduleId}.editor` as AppModulePanelId

const viewEditor: Command = {
  id: `${moduleId}.view.editor` as CommandId,
  label: 'Show view: Editor',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, editorPanelId)
  }
}

export const editorModule: AppModule = {
  id: moduleId,

  panels: [
    {
      id: editorPanelId,
      component: EditorPanel,
      closable: false,
      title: () => 'Editor',
      notificationCount: () => 0
    }
  ],

  commands: [
    viewEditor
  ],

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewShow,
      commandId: viewEditor.id,
      label: 'Editor'
    }
  ]
}
