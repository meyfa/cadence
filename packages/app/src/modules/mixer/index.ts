import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLayout, useRegisterCommand } from '@editor'
import type { FunctionComponent } from 'react'
import { MixerPanel } from './MixerPanel.js'

const moduleId = 'mixer' as ModuleId
export const mixerPanelId = `${moduleId}.mixer` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewMixerId = `${moduleId}.view.mixer` as CommandId

const Commands: FunctionComponent = () => {
  const [, layoutDispatch] = useLayout()

  useRegisterCommand(() => ({
    id: viewMixerId,
    label: 'Show view: Mixer',
    run: () => {
      activateTabOfType(layoutDispatch, mixerPanelId)
    }
  }), [layoutDispatch])

  return null
}

export const mixerModule: Module = {
  id: moduleId,

  Commands,

  panels: [
    {
      id: mixerPanelId,
      closeable: true,
      Panel: MixerPanel,
      Title: () => 'Mixer'
    }
  ],

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewMixerId,
        label: 'Mixer'
      }
    ]
  }
}
