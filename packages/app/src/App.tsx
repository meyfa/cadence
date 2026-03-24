import type { CadenceEditorState, DockLayoutStyles, PartialCadenceEditorState, Storage } from '@editor'
import { DockLayoutView, useLayout } from '@editor'
import { FunctionComponent } from 'react'
import { ConfirmationDialog } from './components/dialogs/ConfirmationDialog.js'
import { Footer } from './components/footer/Footer.js'
import { Header } from './components/header/Header.js'
import { PanelErrorFallback } from './components/tab/PanelErrorFallback.js'
import { useStorageSync } from './hooks/storage.js'
import { isTabClosable, RenderTabContent, RenderTabTitle } from './panes/render-tab.js'

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
        <Header />

        <DockLayoutView
          TabTitleComponent={RenderTabTitle}
          TabContentComponent={RenderTabContent}
          FallbackComponent={PanelErrorFallback}
          styles={dockLayoutStyles}
          layout={layout}
          dispatch={layoutDispatch}
          onBeforeTabClose={isTabClosable}
          className='flex-1 min-h-0 min-w-0'
        />

        <Footer />
      </div>
    </>
  )
}
