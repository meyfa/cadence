import type { Tab, TabContentProps, TabTitleProps } from '@editor'
import type { FunctionComponent } from 'react'
import { StyledTabTitle } from '../components/tab/StyledTabTitle.js'
import { editorModule } from './editor/index.js'
import { exportModule } from './export/index.js'
import { mixerModule } from './mixer/index.js'
import { problemsModule } from './problems/index.js'
import { settingsModule } from './settings/index.js'
import { timelineModule } from './timeline/index.js'
import type { AppModule, AppModulePanel, AppModulePanelId } from './types.js'
import { viewModule } from './view/index.js'

export const modules: readonly AppModule[] = [
  editorModule,
  exportModule,
  mixerModule,
  problemsModule,
  settingsModule,
  viewModule,
  timelineModule
]

const modulesByPanelId: ReadonlyMap<AppModulePanelId, readonly [AppModule, AppModulePanel]> = new Map(
  modules.flatMap((module) =>
    (module.panels ?? []).map((panel) => [panel.id, [module, panel]] as const)
  )
)

export function isTabClosable (tab: Tab): boolean {
  const [, panel] = modulesByPanelId.get(tab.component.type as AppModulePanelId) ?? []
  return panel?.closeable ?? false
}

export const RenderTabTitle: FunctionComponent<TabTitleProps> = ({ tab, ...props }) => {
  const [, panel] = modulesByPanelId.get(tab.component.type as AppModulePanelId) ?? []

  return (
    <StyledTabTitle
      TitleComponent={panel?.Title ?? EmptyStringComponent}
      NotificationsComponent={panel?.Notifications ?? NullComponent}
      tab={tab}
      closeable={panel?.closeable ?? false}
      {...props}
    />
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

  const { Panel } = panel

  return <Panel panelProps={tab.component.props} />
}

const EmptyStringComponent = () => ''
const NullComponent = () => null
