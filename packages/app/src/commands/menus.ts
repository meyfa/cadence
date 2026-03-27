import type { Brand } from '@utility'
import type { CommandId } from './commands.js'
import { CommandIds, MenuSectionIds } from './ids.js'
import { modules } from '../modules/index.js'

export type MenuId = Brand<string, 'app.MenuId'>

export interface Menu {
  readonly id: MenuId
  readonly label: string
  readonly sections: readonly MenuSection[]
}

export type MenuSectionId = Brand<string, 'app.MenuSectionId'>

export interface MenuSection {
  readonly id: MenuSectionId
  readonly items: readonly MenuItem[]
}

export interface MenuItem {
  readonly commandId: CommandId
  readonly label: string
}

export const appMenus: readonly Menu[] = [
  {
    id: 'file' as MenuId,
    label: 'File',
    sections: [
      defineMenuSection(MenuSectionIds.FileSave),
      defineMenuSection(MenuSectionIds.FileExport, [
        { commandId: CommandIds.FileExport, label: 'Export…' }
      ])
    ]
  },
  {
    id: 'view' as MenuId,
    label: 'View',
    sections: [
      defineMenuSection(MenuSectionIds.ViewShow),
      defineMenuSection(MenuSectionIds.ViewLayout, [
        { commandId: CommandIds.LayoutReset, label: 'Reset layout' }
      ])
    ]
  }
]

function defineMenuSection (id: MenuSectionId, items: readonly MenuItem[] = []): MenuSection {
  const moduleItems = modules.flatMap((module) => module.menuItems ?? []).filter((item) => item.menuSectionId === id)

  return {
    id,
    items: [...items, ...moduleItems]
  }
}
