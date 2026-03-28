import type { Module, ModuleId, PanelId, Command, CommandId, MenuSectionId } from '@editor'
import { activateTabOfType } from '@editor'
import type { CommandContext } from '../../commands.js'
import { MixerPanel } from './MixerPanel.js'

const moduleId = 'mixer' as ModuleId
export const mixerPanelId = `${moduleId}.mixer` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewMixer: Command<CommandContext> = {
  id: `${moduleId}.view.mixer` as CommandId,
  label: 'Show view: Mixer',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, mixerPanelId)
  }
}

export const mixerModule: Module<CommandContext> = {
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
