import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLayoutDispatch, useProblems, useRegisterCommand } from '@editor'
import type { FunctionComponent } from 'react'
import { pluralize } from '../../utilities/strings.js'
import { ProblemsPanel } from './ProblemsPanel.js'

const moduleId = 'problems' as ModuleId
export const problemsPanelId = `${moduleId}.problems` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewProblemsId = `${moduleId}.view.problems` as CommandId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()

  useRegisterCommand(() => ({
    id: viewProblemsId,
    label: 'Show view: Problems',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, problemsPanelId))
    }
  }), [layoutDispatch])

  return null
}

export const problemsModule: Module = {
  id: moduleId,

  GlobalHooks,

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

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewProblemsId,
        label: 'Problems'
      }
    ]
  },

  inserts: {
    footer: [
      {
        commandId: viewProblemsId,
        position: 'start',
        Label: () => {
          const problems = useProblems()
          return problems.length === 0 ? 'No errors' : pluralize(problems.length, 'error')
        }
      }
    ]
  }
}
