import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import { useProblems } from '../../hooks/problems.js'
import { pluralize } from '../../utilities/strings.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { ProblemsPanel } from './ProblemsPanel.js'

const moduleId = 'problems' as AppModuleId
export const problemsPanelId = `${moduleId}.problems` as AppModulePanelId

const viewProblems: Command = {
  id: `${moduleId}.view.problems` as CommandId,
  label: 'Show view: Problems',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, problemsPanelId)
  }
}

export const problemsModule: AppModule = {
  id: moduleId,

  panels: [
    {
      id: problemsPanelId,
      closeable: true,
      Panel: ProblemsPanel,
      Title: () => 'Problems',
      Notifications: () => {
        const problems = useProblems()
        return problems.length > 0 ? problems.length : null
      }
    }
  ],

  commands: [
    viewProblems
  ],

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewShow,
      commandId: viewProblems.id,
      label: 'Problems'
    }
  ],

  inserts: {
    footer: [
      {
        commandId: viewProblems.id,
        position: 'start',
        Label: () => {
          const problems = useProblems()
          return problems.length === 0 ? 'No errors' : pluralize(problems.length, 'error')
        }
      }
    ]
  }
}
