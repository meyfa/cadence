import type { DockLayoutStyles, MenuId, MenuSpec } from '@editor'
import { DockLayoutView, useLayout, useLayoutDispatch, useLoadSettled, useRegisterMenu } from '@editor'
import type { FunctionComponent } from 'react'
import { ConfirmationDialog } from './components/dialog/ConfirmationDialog.js'
import { Footer } from './components/footer/Footer.js'
import { Header } from './components/header/Header.js'
import { Logo } from './components/logo/Logo.js'
import { PanelErrorFallback } from './components/tab/PanelErrorFallback.js'
import { StyledTabTitle } from './components/tab/StyledTabTitle.js'
import { useAppPersistenceSync } from './persistence/persistence.js'

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

export const App: FunctionComponent = () => {
  const settled = useLoadSettled()

  const { hasExternalChange, acceptRemoteChanges, keepLocalChanges } = useAppPersistenceSync()

  const layout = useLayout()
  const layoutDispatch = useLayoutDispatch()

  useRegisterMenu(fileMenu)
  useRegisterMenu(viewMenu)

  return (
    <>
      <ConfirmationDialog
        open={hasExternalChange}
        title='External changes detected'
        onConfirm={acceptRemoteChanges}
        onCancel={keepLocalChanges}
        confirmText='Apply'
        cancelText='Ignore'
      >
        The project state has changed in another tab or window. Apply the remote changes?
      </ConfirmationDialog>

      {settled && (
        <div className='flex flex-col h-svh overflow-hidden'>
          <Header logo={<Logo />} />

          <DockLayoutView
            TabTitleComponent={StyledTabTitle}
            FallbackComponent={PanelErrorFallback}
            styles={dockLayoutStyles}
            layout={layout}
            dispatch={layoutDispatch}
            className='flex-1 min-h-0 min-w-0'
          />

          <Footer />
        </div>
      )}
    </>
  )
}
