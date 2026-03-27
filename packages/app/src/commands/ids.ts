import type { MenuSectionId } from './menus.js'

export const MenuSectionIds = Object.freeze({
  ViewShow: 'view.show' as MenuSectionId,
  ViewLayout: 'view.layout' as MenuSectionId,
  FileSave: 'file.save' as MenuSectionId,
  FileExport: 'file.export' as MenuSectionId
} as const)
