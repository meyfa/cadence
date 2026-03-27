import type { Brand } from '@utility'
import { modules } from '../modules/index.js'
import type { CommandId } from './commands.js'
import { MenuSectionIds } from './ids.js'

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
      defineMenuSection(MenuSectionIds.FileExport)
    ]
  },
  {
    id: 'view' as MenuId,
    label: 'View',
    sections: [
      defineMenuSection(MenuSectionIds.ViewShow),
      defineMenuSection(MenuSectionIds.ViewLayout)
    ]
  }
]

function defineMenuSection (id: MenuSectionId): MenuSection {
  const items = modules.flatMap((module) => module.menuItems ?? [])
    .filter((item) => item.menuSectionId === id)
  return { id, items }
}
