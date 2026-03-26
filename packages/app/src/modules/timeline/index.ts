import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { TimelinePanel } from './TimelinePanel.js'

export const timelineModuleId = 'timeline' as AppModuleId
export const timelinePanelId = `${timelineModuleId}.timeline` as AppModulePanelId

export const timelineModule: AppModule = {
  id: timelineModuleId,
  panels: [
    {
      id: timelinePanelId,
      component: TimelinePanel,
      closable: true,
      title: () => 'Timeline',
      notificationCount: () => 0
    }
  ]
}
