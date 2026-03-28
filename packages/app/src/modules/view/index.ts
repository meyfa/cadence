import type { Command, CommandId } from '../../commands/commands.js'
import type { MenuId, MenuSectionId } from '../../commands/menus.js'
import { defaultLayout } from '../../defaults/default-layout.js'
import { applyThemeSetting } from '../../theme.js'
import type { AppModule, AppModuleId } from '../types.js'

const moduleId = 'view' as AppModuleId

const viewMenuId = 'view' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const viewLayoutSectionId = 'view.layout' as MenuSectionId

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
        commandId: layoutReset.id,
        label: 'Reset layout'
      }
    ]
  }
}
