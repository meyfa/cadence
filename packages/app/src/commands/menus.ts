import { useMemo } from 'react'
import { useMenuSpecs } from '../state/MenuContext.js'
import { useModules } from '../state/ModuleContext.js'
import type { Menu, MenuId, MenuItem, MenuItemDefinition, MenuSection, MenuSectionDefinition, MenuSectionId } from './menu-types.js'

export type { Menu, MenuId, MenuItem, MenuItemDefinition, MenuSection, MenuSectionDefinition, MenuSectionId } from './menu-types.js'

export function useAppMenus (): readonly Menu[] {
  const menuSpecs = useMenuSpecs()
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
  }, [menuSpecs, sectionDefinitions, itemDefinitions])
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
