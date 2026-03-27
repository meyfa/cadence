import type { SerializedComponent } from '@editor'
import type { Brand } from '@utility'
import type { ComponentType, ReactNode } from 'react'
import type { Command, CommandId } from '../commands/commands.js'
import type { MenuSectionId } from '../commands/menus.js'

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
  readonly closeable: boolean
  readonly Panel: AppModuleRender<AppModulePanelProps> | ComponentType<AppModulePanelProps>
  readonly Title: AppModuleRender<AppModulePanelProps, string>
  readonly Notifications?: AppModuleRender<AppModulePanelProps, number | null>
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
  readonly Label: AppModuleRender<{}, string>
}

export type AppModuleRender<P = {}, T extends ReactNode = ReactNode> = (props: P) => T
