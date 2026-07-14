import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@meyfa/cadence-editor'
import { activateTabOfType, useLayoutDispatch, useRegisterCommand } from '@meyfa/cadence-editor'
import type { FunctionComponent } from 'react'
import { pluralize } from '../../utilities/format.ts'
import { ProblemsNotifications } from './ProblemsNotifications.tsx'
import { ProblemsPanel } from './ProblemsPanel.tsx'
import { useProblemCountByKind } from './hooks.ts'

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
      layoutDispatch((layout) => activateTabOfType(layout, problemsPanelId, () => ({ type: problemsPanelId })))
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
      Notifications: ProblemsNotifications
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
          const { error, warning } = useProblemCountByKind()

          if (error === 0 && warning === 0) {
            return 'No problems'
          }

          if (warning === 0) {
            return pluralize(error, 'error')
          }

          if (error === 0) {
            return pluralize(warning, 'warning')
          }

          return `${pluralize(error, 'error')}, ${pluralize(warning, 'warning')}`
        }
      }
    ]
  }
}
