import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLayoutDispatch, useRegisterCommand } from '@editor'
import type { FunctionComponent } from 'react'
import { SettingsPanel } from './SettingsPanel.js'

const moduleId = 'settings' as ModuleId
export const settingsPanelId = `${moduleId}.settings` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewSettingsId = `${moduleId}.view.settings` as CommandId

const Commands: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()

  useRegisterCommand(() => ({
    id: viewSettingsId,
    label: 'Show view: Settings',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, settingsPanelId))
    }
  }), [layoutDispatch])

  return null
}

export const settingsModule: Module = {
  id: moduleId,

  Commands,

  panels: [
    {
      id: settingsPanelId,
      closeable: true,
      Panel: SettingsPanel,
      Title: () => 'Settings'
    }
  ],

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewSettingsId,
        label: 'Settings'
      }
    ]
  }
}
