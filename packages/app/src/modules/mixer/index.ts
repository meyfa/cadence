import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLayoutDispatch, useRegisterCommand } from '@editor'
import type { FunctionComponent } from 'react'
import { MixerPanel } from './MixerPanel.js'

const moduleId = 'mixer' as ModuleId
export const mixerPanelId = `${moduleId}.mixer` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewMixerId = `${moduleId}.view.mixer` as CommandId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()

  useRegisterCommand(() => ({
    id: viewMixerId,
    label: 'Show view: Mixer',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, mixerPanelId))
    }
  }), [layoutDispatch])

  return null
}

export const mixerModule: Module = {
  id: moduleId,

  GlobalHooks,

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
