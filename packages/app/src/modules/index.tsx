import type { Tab, TabContentProps, TabTitleProps } from '@editor'
import type { FunctionComponent } from 'react'
import { StyledTabTitle } from '../components/tab/StyledTabTitle.js'
import { useProblems, type Problem } from '../hooks/problems.js'
import { editorModule } from './editor/index.js'
import { mixerModule } from './mixer/index.js'
import { problemsModule } from './problems/index.js'
import { settingsModule } from './settings/index.js'
import { timelineModule } from './timeline/index.js'
import type { AppModule, AppModulePanel, AppModulePanelId } from './types.js'

const modules: readonly AppModule[] = [
  editorModule,
  mixerModule,
  problemsModule,
  settingsModule,
  timelineModule
]

const modulesByPanelId: ReadonlyMap<AppModulePanelId, readonly [AppModule, AppModulePanel]> = new Map(
  modules.flatMap((module) =>
    (module.panels ?? []).map((panel) => [panel.id, [module, panel]] as const)
  )
)

// State that the tab renderers can access. This is to avoid calling hooks outside of components.
export interface TabRendererContext {
  readonly problems: readonly Problem[]
}

export function useTabRendererContext (): TabRendererContext {
  const problems = useProblems()
  return { problems }
}

export function isTabClosable (tab: Tab): boolean {
  const [, panel] = modulesByPanelId.get(tab.component.type as AppModulePanelId) ?? []
  return panel?.closable ?? false
}

export const RenderTabTitle: FunctionComponent<TabTitleProps> = ({ tab, ...props }) => {
  const context = useTabRendererContext()

  const [, panel] = modulesByPanelId.get(tab.component.type as AppModulePanelId) ?? []
  if (panel == null) {
    return (
      <StyledTabTitle title={tab.component.type} notifications={0} closeable={false} {...props} />
    )
  }

  const title = panel.title(tab.component.props, context)
  const notifications = panel.notificationCount(tab.component.props, context)
  const closeable = panel.closable

  return (
    <StyledTabTitle title={title} notifications={notifications} closeable={closeable} {...props} />
  )
}

export const RenderTabContent: FunctionComponent<TabContentProps> = ({ tab }) => {
  const [, panel] = modulesByPanelId.get(tab.component.type as AppModulePanelId) ?? []
  if (panel == null) {
    return (
      <div className='p-4'>
        Unknown tab type: {tab.component.type}
      </div>
    )
  }

  const Component = panel.component

  return <Component panelProps={tab.component.props} />
}
