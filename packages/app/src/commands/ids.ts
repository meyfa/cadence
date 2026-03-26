import type { CommandId } from './commands.js'

export const CommandIds = Object.freeze({
  PlaybackToggle: 'playback.toggle' as CommandId,
  FileOpen: 'file.open' as CommandId,
  FileSave: 'file.save' as CommandId,
  FileExport: 'file.export' as CommandId,
  ViewEditor: 'view.editor' as CommandId,
  ViewMixer: 'view.mixer' as CommandId,
  ViewSettings: 'view.settings' as CommandId,
  ViewProblems: 'view.problems' as CommandId,
  ViewTimeline: 'view.timeline' as CommandId,
  ThemeDark: 'theme.dark' as CommandId,
  ThemeLight: 'theme.light' as CommandId,
  ThemeSystem: 'theme.system' as CommandId,
  LayoutReset: 'layout.reset' as CommandId,
  CommandsShowAll: 'commands.show-all' as CommandId
} as const)
