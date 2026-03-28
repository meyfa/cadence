import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import type { MenuSectionId } from '../../commands/menus.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { MixerPanel } from './MixerPanel.js'

const moduleId = 'mixer' as AppModuleId
export const mixerPanelId = `${moduleId}.mixer` as AppModulePanelId

const viewShowSectionId = 'view.show' as MenuSectionId

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

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewMixer.id,
        label: 'Mixer'
      }
    ]
  }
}
