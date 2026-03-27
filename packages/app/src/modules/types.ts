import type { SerializedComponent } from '@editor'
import type { Brand } from '@utility'
import type { ComponentType } from 'react'
import type { Command, CommandId } from '../commands/commands.js'
import type { TabRendererContext } from './index.js'
import type { MenuSectionId } from '../commands/menus.js'

export type AppModuleId = Brand<string, 'app.AppModuleId'>

export interface AppModule {
  readonly id: AppModuleId
  readonly panels?: readonly AppModulePanel[]
  readonly commands?: readonly Command[]
  readonly menuItems?: readonly AppModuleMenuItem[]
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

export interface AppModuleMenuItem {
  readonly menuSectionId: MenuSectionId
  readonly commandId: CommandId
  readonly label: string
}
