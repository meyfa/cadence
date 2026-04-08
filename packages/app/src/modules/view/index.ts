import type { Command, CommandId, MenuId, MenuSectionId, Module, ModuleId } from '@editor'
import { useLayoutDispatch, useRegisterCommand } from '@editor'
import type { FunctionComponent } from 'react'
import { defaultLayout } from '../../defaults/default-layout.js'
import { applyThemeSetting } from '../../theme.js'
import { useViewSettingsSync } from './persistence.js'
import { ThemeSettingsCard } from './ThemeSettingsCard.js'

const moduleId = 'view' as ModuleId

const viewMenuId = 'view' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const viewLayoutSectionId = 'view.layout' as MenuSectionId

const layoutResetId = `${moduleId}.reset` as CommandId

const themeDark: Command = {
  id: `${moduleId}.theme.dark` as CommandId,
  label: 'Theme: Dark',
  run: () => {
    applyThemeSetting('dark')
  }
}

const themeLight: Command = {
  id: `${moduleId}.theme.light` as CommandId,
  label: 'Theme: Light',
  run: () => {
    applyThemeSetting('light')
  }
}

const themeSystem: Command = {
  id: `${moduleId}.theme.system` as CommandId,
  label: 'Theme: System',
  run: () => {
    applyThemeSetting('system')
  }
}

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()
  useViewSettingsSync()

  useRegisterCommand(() => ({
    id: layoutResetId,
    label: 'Layout: Reset to default',
    run: () => {
      layoutDispatch(defaultLayout)
    }
  }), [layoutDispatch])

  useRegisterCommand(themeDark, [])
  useRegisterCommand(themeLight, [])
  useRegisterCommand(themeSystem, [])

  return null
}

export const viewModule: Module = {
  id: moduleId,

  GlobalHooks,

  menu: {
    sections: [
      {
        id: viewShowSectionId,
        menuId: viewMenuId
      },
      {
        id: viewLayoutSectionId,
        menuId: viewMenuId
      }
    ],

    items: [
      {
        sectionId: viewLayoutSectionId,
        commandId: layoutResetId,
        label: 'Reset layout'
      }
    ]
  },

  settings: {
    cards: [
      ThemeSettingsCard
    ]
  }
}
