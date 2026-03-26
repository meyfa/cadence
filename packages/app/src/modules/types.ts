import type { SerializedComponent } from '@editor'
import type { Brand } from '@utility'
import type { ComponentType } from 'react'
import type { TabRendererContext } from './index.js'

export type AppModuleId = Brand<string, 'app.AppModuleId'>

export interface AppModule {
  readonly id: AppModuleId
  readonly panels?: readonly AppModulePanel[]
}

export type AppModulePanelId = Brand<string, 'app.AppModulePanelId'>

export interface AppModulePanel {
  readonly id: AppModulePanelId
  readonly component: ComponentType<AppModulePanelProps>
  readonly closable: boolean
  readonly title: (props: SerializedComponent['props'], context: TabRendererContext) => string
  readonly notificationCount: (props: SerializedComponent['props'], context: TabRendererContext) => number
}

export interface AppModulePanelProps {
  readonly panelProps: SerializedComponent['props']
}
