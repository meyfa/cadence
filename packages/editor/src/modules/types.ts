import type { Brand } from '@utility'
import type { ComponentType, ReactNode } from 'react'
import type { CommandId } from '../commands/commands.js'
import type { MenuItemDefinition, MenuSectionDefinition } from '../commands/menus.js'
import type { SerializedComponent } from '../layout/types.js'

export type ModuleRenderFn<P = {}, T extends ReactNode = ReactNode> = (props: P) => T

export type ModuleId = Brand<string, 'editor.ModuleId'>

export interface Module {
  readonly id: ModuleId
  readonly GlobalHooks?: ComponentType
  readonly panels?: readonly Panel[]
  readonly menu?: {
    readonly sections?: readonly MenuSectionDefinition[]
    readonly items?: readonly MenuItemDefinition[]
  }
  readonly settings?: {
    readonly cards?: readonly ComponentType[]
  }
  readonly inserts?: {
    readonly header?: readonly HeaderInsert[]
    readonly footer?: readonly FooterInsert[]
  }
}

export type PanelId = Brand<string, 'editor.PanelId'>

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
