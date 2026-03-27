import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { SettingsPanel } from './SettingsPanel.js'

const moduleId = 'settings' as AppModuleId
export const settingsPanelId = `${moduleId}.settings` as AppModulePanelId

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
      component: SettingsPanel,
      closable: true,
      title: () => 'Settings',
      notificationCount: () => 0
    }
  ],

  commands: [
    viewSettings
  ],

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewShow,
      commandId: viewSettings.id,
      label: 'Settings'
    }
  ]
}
