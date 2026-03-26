import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { SettingsPanel } from './SettingsPanel.js'

export const settingsModuleId = 'settings' as AppModuleId
export const settingsPanelId = `${settingsModuleId}.settings` as AppModulePanelId

export const settingsModule: AppModule = {
  id: settingsModuleId,
  panels: [
    {
      id: settingsPanelId,
      component: SettingsPanel,
      closable: true,
      title: () => 'Settings',
      notificationCount: () => 0
    }
  ]
}
