import type { Brand } from '@utility'
import type { CommandId } from './commands.js'

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

export interface MenuSpec {
  readonly id: MenuId
  readonly label: string
}

export interface MenuSectionDefinition {
  readonly id: MenuSectionId
  readonly menuId: MenuId
}

export interface MenuItemDefinition extends MenuItem {
  readonly sectionId: MenuSectionId
  readonly commandId: CommandId
  readonly label: string
}
