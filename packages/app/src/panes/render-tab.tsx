import type { SerializedComponent, Tab, TabContentProps, TabTitleProps } from '@editor'
import type { FunctionComponent, ReactNode } from 'react'
import { StyledTabTitle } from '../components/tab/StyledTabTitle.js'
import { useProblems, type Problem } from '../hooks/problems.js'
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
  readonly problems: readonly Problem[]
}

export function useTabRendererContext (): TabRendererContext {
  const problems = useProblems()
  return { problems }
}

interface TabRenderer {
  readonly render: (props: SerializedComponent['props'], context: TabRendererContext) => ReactNode
  readonly title: (props: SerializedComponent['props'], context: TabRendererContext) => string
  readonly notificationCount?: (props: SerializedComponent['props'], context: TabRendererContext) => number
  readonly closable?: boolean
}

const tabRenderers: ReadonlyMap<TabType, TabRenderer> = (() => new Map<TabType, TabRenderer>([
  [TabTypes.Editor, {
    render: () => (<EditorPane />),
    title: () => 'Editor'
  }],

  [TabTypes.Settings, {
    render: () => (<SettingsPane />),
    title: () => 'Settings',
    closable: true
  }],

  [TabTypes.Problems, {
    render: () => (<ProblemsPane />),
    title: () => 'Problems',
    notificationCount: (_props, { problems }) => problems.length,
    closable: true
  }],

  [TabTypes.Mixer, {
    render: () => (<MixerPane />),
    title: () => 'Mixer',
    closable: true
  }],

  [TabTypes.Timeline, {
    render: () => (<TimelinePane />),
    title: () => 'Timeline',
    closable: true
  }]
]))()

export function isTabClosable (tab: Tab): boolean {
  const renderer = tabRenderers.get(tab.component.type as TabType)
  return renderer?.closable ?? false
}

export const RenderTabTitle: FunctionComponent<TabTitleProps> = ({ tab, ...props }) => {
  const context = useTabRendererContext()

  const renderer = tabRenderers.get(tab.component.type as TabType)
  if (renderer == null) {
    return (
      <StyledTabTitle title={tab.component.type} notifications={0} closeable={false} {...props} />
    )
  }

  const title = renderer.title(tab.component.props, context)
  const notifications = renderer.notificationCount?.(tab.component.props, context) ?? 0
  const closeable = renderer.closable ?? false

  return (
    <StyledTabTitle title={title} notifications={notifications} closeable={closeable} {...props} />
  )
}

export const RenderTabContent: FunctionComponent<TabContentProps> = ({ tab }) => {
  const context = useTabRendererContext()

  const renderer = tabRenderers.get(tab.component.type as TabType)
  if (renderer == null) {
    return (
      <div className='p-4'>
        Unknown tab type: {tab.component.type}
      </div>
    )
  }

  return renderer.render(tab.component.props, context)
}
