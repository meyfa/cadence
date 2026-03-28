import type { Module, ModuleId, PanelId, Command, CommandId, MenuSectionId } from '@editor'
import { activateTabOfType } from '@editor'
import type { CommandContext } from '../../commands.js'
import { SettingsPanel } from './SettingsPanel.js'

const moduleId = 'settings' as ModuleId
export const settingsPanelId = `${moduleId}.settings` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewSettings: Command<CommandContext> = {
  id: `${moduleId}.view.settings` as CommandId,
  label: 'Show view: Settings',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, settingsPanelId)
  }
}

export const settingsModule: Module<CommandContext> = {
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
