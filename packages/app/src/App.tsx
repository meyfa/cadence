import type { CadenceEditorState, PartialCadenceEditorState, Storage } from '@editor'
import { FunctionComponent } from 'react'
import { ConfirmationDialog } from './components/dialogs/ConfirmationDialog.js'
import { Footer } from './components/footer/Footer.js'
import { Header } from './components/header/Header.js'
import { useStorageSync } from './hooks/storage.js'
import { DockLayoutView } from './layout/DockLayoutView.js'
import { PanelErrorBoundary } from './layout/PanelErrorBoundary.js'
import { useLayout } from './state/LayoutContext.js'

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

        <PanelErrorBoundary>
          <DockLayoutView
            layout={layout}
            dispatch={layoutDispatch}
            className='flex-1 min-h-0 min-w-0'
          />
        </PanelErrorBoundary>

        <Footer />
      </div>
    </>
  )
}
