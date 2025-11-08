import type { SerializedComponent } from '@editor/state/layout.js'
import type { ReactNode } from 'react'
import { useCompilationState, type CompilationState } from '../state/CompilationContext.js'
import { EditorPane } from './EditorPane.js'
import { MixerPane } from './MixerPane.js'
import { ProblemsPane } from './ProblemsPane.js'
import { SettingsPane } from './SettingsPane.js'
import { TimelinePane } from './TimelinePane.js'

export const TabTypes = Object.freeze({
  Settings: 'settings',
  Editor: 'editor',
  Problems: 'problems',
  Mixer: 'mixer',
  Timeline: 'timeline'
} as const)

export type TabType = typeof TabTypes[keyof typeof TabTypes]

// State that the tab renderers can access. This is to avoid calling hooks outside of components.
export interface TabRendererContext {
  readonly compilation: CompilationState
}

export function useTabRendererContext (): TabRendererContext {
  const compilation = useCompilationState()
  return { compilation }
}

interface TabRenderer {
  readonly render: (props: SerializedComponent['props'], context: TabRendererContext) => ReactNode
  readonly title: (props: SerializedComponent['props'], context: TabRendererContext) => string
  readonly notificationCount?: (props: SerializedComponent['props'], context: TabRendererContext) => number
}

const tabRenderers: ReadonlyMap<TabType, TabRenderer> = (() => new Map<TabType, TabRenderer>([
  [TabTypes.Settings, {
    render: () => (<SettingsPane />),
    title: () => 'Settings'
  }],

  [TabTypes.Editor, {
    render: () => (<EditorPane />),
    title: () => 'Editor'
  }],

  [TabTypes.Problems, {
    render: () => (<ProblemsPane />),
    title: () => 'Problems',
    notificationCount: (_props, { compilation }) => compilation.errors.length
  }],

  [TabTypes.Mixer, {
    render: () => (<MixerPane />),
    title: () => 'Mixer'
  }],

  [TabTypes.Timeline, {
    render: () => (<TimelinePane />),
    title: () => 'Timeline'
  }]
]))()

export function renderTabContent (data: SerializedComponent, context: TabRendererContext): ReactNode {
  const renderer = tabRenderers.get(data.type as TabType)
  if (renderer != null) {
    return renderer.render(data.props, context)
  }

  return (
    <div className='p-4'>
      Unknown tab type: {data.type}
    </div>
  )
}

export function renderTabTitle (data: SerializedComponent, context: TabRendererContext): string {
  const renderer = tabRenderers.get(data.type as TabType)
  if (renderer != null) {
    return renderer.title(data.props, context)
  }

  return data.type
}

export function renderTabNotificationCount (data: SerializedComponent, context: TabRendererContext): number {
  const renderer = tabRenderers.get(data.type as TabType)
  if (renderer?.notificationCount != null) {
    return renderer.notificationCount(data.props, context)
  }

  return 0
}
