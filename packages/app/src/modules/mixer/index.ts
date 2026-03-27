import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { MixerPanel } from './MixerPanel.js'

const moduleId = 'mixer' as AppModuleId
export const mixerPanelId = `${moduleId}.mixer` as AppModulePanelId

const viewMixer: Command = {
  id: `${moduleId}.view.mixer` as CommandId,
  label: 'Show view: Mixer',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, mixerPanelId)
  }
}

export const mixerModule: AppModule = {
  id: moduleId,

  panels: [
    {
      id: mixerPanelId,
      closeable: true,
      Panel: MixerPanel,
      Title: () => 'Mixer'
    }
  ],

  commands: [
    viewMixer
  ],

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewShow,
      commandId: viewMixer.id,
      label: 'Mixer'
    }
  ]
}
