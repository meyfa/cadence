import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { MixerPanel } from './MixerPanel.js'

export const mixerModuleId = 'mixer' as AppModuleId
export const mixerPanelId = `${mixerModuleId}.mixer` as AppModulePanelId

export const mixerModule: AppModule = {
  id: mixerModuleId,
  panels: [
    {
      id: mixerPanelId,
      component: MixerPanel,
      closable: true,
      title: () => 'Mixer',
      notificationCount: () => 0
    }
  ]
}
