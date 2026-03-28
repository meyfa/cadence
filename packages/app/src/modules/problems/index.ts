import type { Module, ModuleId, PanelId, Command, CommandId, MenuSectionId } from '@editor'
import { activateTabOfType } from '@editor'
import type { CommandContext } from '../../commands.js'
import { useProblems } from '../../hooks/problems.js'
import { pluralize } from '../../utilities/strings.js'
import { ProblemsPanel } from './ProblemsPanel.js'

const moduleId = 'problems' as ModuleId
export const problemsPanelId = `${moduleId}.problems` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewProblems: Command<CommandContext> = {
  id: `${moduleId}.view.problems` as CommandId,
  label: 'Show view: Problems',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, problemsPanelId)
  }
}

export const problemsModule: Module<CommandContext> = {
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

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewProblems.id,
        label: 'Problems'
      }
    ]
  },

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
