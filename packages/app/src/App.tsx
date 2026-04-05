import type { DockLayoutStyles, MenuId, MenuSpec, Module, Panel, PanelId, Tab, TabContentProps, TabTitleProps } from '@editor'
import { DockLayoutView, useLayout, useModules, useRegisterMenu } from '@editor'
import { FunctionComponent, useCallback, useMemo } from 'react'
import { ConfirmationDialog } from './components/dialog/ConfirmationDialog.js'
import { Footer } from './components/footer/Footer.js'
import { Header } from './components/header/Header.js'
import { Logo } from './components/logo/Logo.js'
import { PanelErrorFallback } from './components/tab/PanelErrorFallback.js'
import { StyledTabTitle } from './components/tab/StyledTabTitle.js'
import { useStorageSync } from './hooks/storage.js'
import type { CadenceEditorState, PartialCadenceEditorState } from './state/state.js'
import type { Storage } from './state/storage.js'

const fileMenu: MenuSpec = {
  id: 'file' as MenuId,
  label: 'File'
}

const viewMenu: MenuSpec = {
  id: 'view' as MenuId,
  label: 'View'
}

const dockLayoutStyles: DockLayoutStyles = {
  highlightColor: 'var(--color-accent-200)',
  tabListBackgroundColor: 'var(--color-surface-200)',
  tabListBorderColor: 'var(--color-frame-200)',
  dropIndicatorColor: 'var(--color-content-300)'
}

export const App: FunctionComponent<{
  storage: Storage<CadenceEditorState, PartialCadenceEditorState>
  initialState: CadenceEditorState
}> = ({ storage, initialState }) => {
  const [hasExternalChange, resetExternalChange] = useStorageSync(storage, initialState)

  const [layout, layoutDispatch] = useLayout()
  const onBeforeTabClose = useOnBeforeTabClose()

  useRegisterMenu(fileMenu)
  useRegisterMenu(viewMenu)

  return (
    <>
      <ConfirmationDialog
        open={hasExternalChange}
        title='External changes detected'
        onConfirm={() => window.location.reload()}
        onCancel={resetExternalChange}
        confirmText='Reload'
        cancelText='Ignore'
      >
        The editor state has changed in another tab or window. Reload to apply the changes?
      </ConfirmationDialog>

      <div className='flex flex-col h-dvh'>
        <Header logo={<Logo />} />

        <DockLayoutView
          TabTitleComponent={RenderTabTitle}
          TabContentComponent={RenderTabContent}
          FallbackComponent={PanelErrorFallback}
          styles={dockLayoutStyles}
          layout={layout}
          dispatch={layoutDispatch}
          onBeforeTabClose={onBeforeTabClose}
          className='flex-1 min-h-0 min-w-0'
        />

        <Footer />
      </div>
    </>
  )
}

function useOnBeforeTabClose (): (tab: Tab) => boolean {
  const modules = useModules()

  return useCallback((tab: Tab) => {
    const panel = findPanelById(modules, tab.component.type as PanelId)
    return panel?.closeable ?? false
  }, [modules])
}

const RenderTabTitle: FunctionComponent<TabTitleProps> = ({ tab, ...props }) => {
  const panel = usePanelById(tab.component.type as PanelId)

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

const RenderTabContent: FunctionComponent<TabContentProps> = ({ tab }) => {
  const panel = usePanelById(tab.component.type as PanelId)

  if (panel == null) {
    return (
      <div className='p-4'>
        Unknown tab type: {tab.component.type}
      </div>
    )
  }

  return <panel.Panel panelProps={tab.component.props} />
}

const EmptyStringComponent = () => ''
const NullComponent = () => null

function findPanelById (modules: readonly Module[], id: PanelId): Panel | undefined {
  for (const module of modules) {
    for (const panel of module.panels ?? []) {
      if (panel.id === id) {
        return panel
      }
    }
  }
  return undefined
}

function usePanelById (id: PanelId): Panel | undefined {
  const modules = useModules()

  return useMemo(() => findPanelById(modules, id), [modules, id])
}
