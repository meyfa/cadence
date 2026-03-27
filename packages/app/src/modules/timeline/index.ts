import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { TimelinePanel } from './TimelinePanel.js'

const moduleId = 'timeline' as AppModuleId
export const timelinePanelId = `${moduleId}.timeline` as AppModulePanelId

const viewTimeline: Command = {
  id: `${moduleId}.view.timeline` as CommandId,
  label: 'Show view: Timeline',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, timelinePanelId)
  }
}

export const timelineModule: AppModule = {
  id: moduleId,

  panels: [
    {
      id: timelinePanelId,
      component: TimelinePanel,
      closable: true,
      title: () => 'Timeline',
      notificationCount: () => 0
    }
  ],

  commands: [
    viewTimeline
  ],

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewShow,
      commandId: viewTimeline.id,
      label: 'Timeline'
    }
  ]
}
