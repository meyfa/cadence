import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import { defaultLayout } from '../../defaults/default-layout.js'
import { applyThemeSetting } from '../../theme.js'
import type { AppModule, AppModuleId } from '../types.js'

const moduleId = 'view' as AppModuleId

const layoutReset: Command = {
  id: `${moduleId}.reset` as CommandId,
  label: 'Layout: Reset to default',
  action: ({ layoutDispatch }) => {
    layoutDispatch(defaultLayout)
  }
}

const themeDark: Command = {
  id: `${moduleId}.theme.dark` as CommandId,
  label: 'Theme: Dark',
  action: () => {
    applyThemeSetting('dark')
  }
}

const themeLight: Command = {
  id: `${moduleId}.theme.light` as CommandId,
  label: 'Theme: Light',
  action: () => {
    applyThemeSetting('light')
  }
}

const themeSystem: Command = {
  id: `${moduleId}.theme.system` as CommandId,
  label: 'Theme: System',
  action: () => {
    applyThemeSetting('system')
  }
}

export const viewModule: AppModule = {
  id: moduleId,

  commands: [
    layoutReset,
    themeDark,
    themeLight,
    themeSystem
  ],

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewLayout,
      commandId: layoutReset.id,
      label: 'Reset layout'
    }
  ]
}
