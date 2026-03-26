import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { ProblemsPanel } from './ProblemsPanel.js'

export const problemsModuleId = 'problems' as AppModuleId
export const problemsPanelId = `${problemsModuleId}.problems` as AppModulePanelId

export const problemsModule: AppModule = {
  id: problemsModuleId,
  panels: [
    {
      id: problemsPanelId,
      component: ProblemsPanel,
      closable: true,
      title: () => 'Problems',
      notificationCount: (_props, context) => context.problems.length
    }
  ]
}
