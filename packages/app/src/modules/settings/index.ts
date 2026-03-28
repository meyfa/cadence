import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import type { MenuSectionId } from '../../commands/menus.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { SettingsPanel } from './SettingsPanel.js'

const moduleId = 'settings' as AppModuleId
export const settingsPanelId = `${moduleId}.settings` as AppModulePanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewSettings: Command = {
  id: `${moduleId}.view.settings` as CommandId,
  label: 'Show view: Settings',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, settingsPanelId)
  }
}

export const settingsModule: AppModule = {
  id: moduleId,

  panels: [
    {
      id: settingsPanelId,
      closeable: true,
      Panel: SettingsPanel,
      Title: () => 'Settings'
    }
  ],

  commands: [
    viewSettings
  ],

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewSettings.id,
        label: 'Settings'
      }
    ]
  }
}
