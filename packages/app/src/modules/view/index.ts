import type { Module, ModuleId, Command, CommandId, MenuId, MenuSectionId } from '@editor'
import type { CommandContext } from '../../commands.js'
import { defaultLayout } from '../../defaults/default-layout.js'
import { applyThemeSetting } from '../../theme.js'

const moduleId = 'view' as ModuleId

const viewMenuId = 'view' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const viewLayoutSectionId = 'view.layout' as MenuSectionId

const layoutReset: Command<CommandContext> = {
  id: `${moduleId}.reset` as CommandId,
  label: 'Layout: Reset to default',
  action: ({ layoutDispatch }) => {
    layoutDispatch(defaultLayout)
  }
}

const themeDark: Command<CommandContext> = {
  id: `${moduleId}.theme.dark` as CommandId,
  label: 'Theme: Dark',
  action: () => {
    applyThemeSetting('dark')
  }
}

const themeLight: Command<CommandContext> = {
  id: `${moduleId}.theme.light` as CommandId,
  label: 'Theme: Light',
  action: () => {
    applyThemeSetting('light')
  }
}

const themeSystem: Command<CommandContext> = {
  id: `${moduleId}.theme.system` as CommandId,
  label: 'Theme: System',
  action: () => {
    applyThemeSetting('system')
  }
}

export const viewModule: Module<CommandContext> = {
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
