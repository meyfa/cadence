import type { SerializedComponent } from '@editor'
import type { Brand } from '@utility'
import type { ComponentType } from 'react'
import type { Command, CommandId } from '../commands/commands.js'
import type { MenuSectionId } from '../commands/menus.js'
import type { TabRendererContext } from './index.js'

export type AppModuleId = Brand<string, 'app.AppModuleId'>

export interface AppModule {
  readonly id: AppModuleId
  readonly panels?: readonly AppModulePanel[]
  readonly commands?: readonly Command[]
  readonly menuItems?: readonly AppModuleMenuItem[]
  readonly inserts?: AppModuleInserts
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

export interface AppModuleInserts {
  readonly footer?: readonly AppModuleInsert[]
}

type AppModuleInsertPosition = 'start' | 'end'

export interface AppModuleInsert {
  readonly position: AppModuleInsertPosition
  readonly commandId: CommandId
  readonly label: (context: TabRendererContext) => string
}
