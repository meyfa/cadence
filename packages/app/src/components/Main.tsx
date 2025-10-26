import { useMemo, type FunctionComponent, type ReactNode } from 'react'
import { DockLayoutView } from '../layout/DockLayoutView.js'
import type { DockLayout } from '@editor/layout.js'
import { EditorPane } from '../panes/EditorPane.js'
import { MixerPane } from '../panes/MixerPane.js'
import { ProblemsPane } from '../panes/ProblemsPane.js'
import { SettingsPane } from '../panes/SettingsPane.js'
import { TimelinePane } from '../panes/TimelinePane.js'
import { useCompilationState } from '../state/CompilationContext.js'

export const Main: FunctionComponent = () => {
  const { errors } = useCompilationState()
  const problemCount = errors.length

  const layout = useMemo<DockLayout<ReactNode>>(() => {
    return {
      main: {
        id: 'main-split',
        type: 'split',
        direction: 'vertical',
        sizes: [0.8, 0.2],
        children: [
          {
            id: 'main-tabs',
            type: 'pane',
            tabs: [
              {
                id: 'editor',
                title: 'Editor',
                render: () => (<EditorPane />)
              },
              {
                id: 'mixer',
                title: 'Mixer',
                render: () => (<MixerPane />)
              },
              {
                id: 'settings',
                title: 'Settings',
                render: () => (<SettingsPane />)
              }
            ],
            activeTabId: 'editor'
          },
          {
            id: 'bottom-dock',
            type: 'pane',
            tabs: [
              {
                id: 'problems',
                title: 'Problems',
                render: () => (<ProblemsPane />),
                notificationCount: problemCount
              },
              {
                id: 'timeline',
                title: 'Timeline',
                render: () => (<TimelinePane />)
              }
            ],
            activeTabId: 'timeline'
          }
        ]
      }
    }
  }, [problemCount])

  return (
    <DockLayoutView layout={layout} className='flex-1 min-h-0 min-w-0' />
  )
}
