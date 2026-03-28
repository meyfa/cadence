import type { Brand } from '@utility'
import type { ComponentType, ReactNode } from 'react'
import type { Command, CommandId } from '../commands/commands.js'
import type { MenuItemDefinition, MenuSectionDefinition } from '../commands/menus.js'
import type { SerializedComponent } from '../layout/types.js'

export type ModuleRenderFn<P = {}, T extends ReactNode = ReactNode> = (props: P) => T

export type ModuleId = Brand<string, 'app.ModuleId'>

export interface Module<TContext = unknown> {
  readonly id: ModuleId
  readonly panels?: readonly Panel[]
  readonly commands?: ReadonlyArray<Command<TContext>>
  readonly menu?: {
    readonly sections?: readonly MenuSectionDefinition[]
    readonly items?: readonly MenuItemDefinition[]
  }
  readonly inserts?: {
    readonly header?: readonly HeaderInsert[]
    readonly footer?: readonly FooterInsert[]
  }
}

export type PanelId = Brand<string, 'app.PanelId'>

export interface Panel {
  readonly id: PanelId
  readonly closeable: boolean
  readonly Panel: ComponentType<PanelProps>
  readonly Title: ModuleRenderFn<PanelProps, string>
  readonly Notifications?: ModuleRenderFn<PanelProps, number | null>
}

export interface PanelProps {
  readonly panelProps: SerializedComponent['props']
}

export interface HeaderInsert {
  readonly position: 'start' | 'middle'
  readonly Component: ComponentType
}

export interface FooterInsert {
  readonly position: 'start' | 'end'
  readonly commandId: CommandId
  readonly Label: ModuleRenderFn<{}, string>
}
