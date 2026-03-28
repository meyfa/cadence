import type { Brand } from '@utility'
import { useMemo } from 'react'
import { useModules } from '../state/ModuleContext.js'
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

export interface MenuSectionDefinition {
  readonly id: MenuSectionId
  readonly menuId: MenuId
}

export interface MenuItemDefinition extends MenuItem {
  readonly sectionId: MenuSectionId
  readonly commandId: CommandId
  readonly label: string
}

const menuSpecs = [
  {
    id: 'file' as MenuId,
    label: 'File'
  },
  {
    id: 'view' as MenuId,
    label: 'View'
  }
] as const

export function useAppMenus (): readonly Menu[] {
  const modules = useModules()

  const sectionDefinitions = useMemo(() => {
    return modules.flatMap((module) => module.menu?.sections ?? [])
  }, [modules])

  const itemDefinitions = useMemo(() => {
    return modules.flatMap((module) => module.menu?.items ?? [])
  }, [modules])

  return useMemo(() => {
    const sectionsById = collectSections(sectionDefinitions)
    assertAllItemsTargetKnownSections(itemDefinitions, sectionsById)

    return menuSpecs.map((menu) => ({
      id: menu.id,
      label: menu.label,
      sections: buildMenuSections(menu.id, sectionsById, itemDefinitions)
    })).filter((menu) => menu.sections.length > 0)
  }, [sectionDefinitions, itemDefinitions])
}

function collectSections (
  definitions: readonly MenuSectionDefinition[]
): ReadonlyMap<MenuSectionId, MenuSectionDefinition> {
  const map = new Map<MenuSectionId, MenuSectionDefinition>()

  for (const definition of definitions) {
    const existing = map.get(definition.id)
    if (existing == null) {
      map.set(definition.id, definition)
      continue
    }

    if (existing.menuId !== definition.menuId) {
      const section = JSON.stringify(definition.id)
      const menuA = JSON.stringify(existing.menuId)
      const menuB = JSON.stringify(definition.menuId)
      throw new Error(`Menu section ${section} is contributed to multiple menus: ${menuA} and ${menuB}.`)
    }
  }

  return map
}

function assertAllItemsTargetKnownSections (
  items: readonly MenuItemDefinition[],
  sectionsById: ReadonlyMap<MenuSectionId, MenuSectionDefinition>
): void {
  for (const item of items) {
    if (!sectionsById.has(item.sectionId)) {
      const section = JSON.stringify(item.sectionId)
      const command = JSON.stringify(item.commandId)
      throw new Error(`Unknown menu section ${section} referenced by menu item with command ${command}.`)
    }
  }
}

function buildMenuSections (
  menuId: MenuId,
  sectionsById: ReadonlyMap<MenuSectionId, MenuSectionDefinition>,
  itemDefinitions: readonly MenuItemDefinition[]
): readonly MenuSection[] {
  return [...sectionsById.values()]
    .filter((section) => section.menuId === menuId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((section) => ({
      id: section.id,
      items: buildMenuItems(section.id, itemDefinitions)
    }))
    .filter((section) => section.items.length > 0)
}

function buildMenuItems (
  sectionId: MenuSectionId,
  itemDefinitions: readonly MenuItemDefinition[]
): readonly MenuItem[] {
  return itemDefinitions
    .filter((item) => item.sectionId === sectionId)
    .map(({ commandId, label }) => ({ commandId, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
