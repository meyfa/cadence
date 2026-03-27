import type { CommandId } from './commands.js'
import type { MenuSectionId } from './menus.js'

export const CommandIds = Object.freeze({
  PlaybackToggle: 'playback.toggle' as CommandId,
  ThemeDark: 'theme.dark' as CommandId,
  ThemeLight: 'theme.light' as CommandId,
  ThemeSystem: 'theme.system' as CommandId,
  LayoutReset: 'layout.reset' as CommandId,
  CommandsShowAll: 'commands.show-all' as CommandId
} as const)

export const MenuSectionIds = Object.freeze({
  ViewShow: 'view.show' as MenuSectionId,
  ViewLayout: 'view.layout' as MenuSectionId,
  FileSave: 'file.save' as MenuSectionId,
  FileExport: 'file.export' as MenuSectionId
} as const)
