import { MenuButton, Menu as MenuContainer, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react'
import { ArrowLeft, ArrowRight, Menu as MenuIcon } from '@mui/icons-material'
import clsx from 'clsx'
import { Fragment, useCallback, useLayoutEffect, useMemo, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import type { Command, CommandId } from '../../commands/commands.js'
import { useAppMenus, type Menu, type MenuId, type MenuSection } from '../../commands/menus.js'
import { useCommandRegistry } from '../../commands/registry.js'
import { ShortcutKeys } from './ShortcutKeys.js'

type DispatchCommand = (command: Command) => void

export const MainMenu: FunctionComponent = () => {
  const { dispatchCommand } = useCommandRegistry()
  const appMenus = useAppMenus()

  return (
    <div className='relative'>
      <div className='hidden md:block'>
        <DesktopMenu dispatch={dispatchCommand} menus={appMenus} />
      </div>

      <MenuContainer as='div' className='md:hidden relative'>
        {({ open, close }) => (
          <MobileMenu open={open} close={close} dispatch={dispatchCommand} menus={appMenus} />
        )}
      </MenuContainer>
    </div>
  )
}

const DesktopMenu: FunctionComponent<{
  dispatch: DispatchCommand
  menus: readonly Menu[]
}> = ({ dispatch, menus }) => {
  return (
    <>
      {menus.map((menu) => (
        <MenuContainer key={menu.id} as='div' className='relative inline-block text-left'>
          <MenuButton
            className={clsx(
              'px-2 rounded-sm outline-none border border-transparent',
              'hocus:bg-surface-300 hocus:text-content-300 hocus:border-frame-300',
              'data-active:bg-surface-300 data-active:border-frame-300'
            )}
          >
            {menu.label}
          </MenuButton>
          <MainMenuItems>
            <MainMenuSections sections={menu.sections} dispatch={dispatch} />
          </MainMenuItems>
        </MenuContainer>
      ))}
    </>
  )
}

const MobileMenu: FunctionComponent<{
  open: boolean
  close: () => void
  dispatch: DispatchCommand
  menus: readonly Menu[]
}> = ({ open, close, dispatch, menus }) => {
  const [mobileMenuId, setMobileMenuId] = useState<MenuId | undefined>(undefined)

  // Reset submenu when menu closes
  useLayoutEffect(() => {
    if (!open) {
      setMobileMenuId(undefined)
    }
  }, [open])

  const selectedMenu = useMemo(() => {
    return mobileMenuId != null ? menus.find((menu) => menu.id === mobileMenuId) : undefined
  }, [mobileMenuId, menus])

  const onBack = useCallback(() => {
    setMobileMenuId(undefined)
  }, [])

  const dispatchAndClose = useCallback((command: Command) => {
    dispatch(command)
    close()
  }, [dispatch, close])

  return (
    <>
      <MenuButton
        className={clsx(
          'h-8 px-2 rounded-sm outline-none flex items-center gap-2 text-content-200 border border-transparent',
          'hocus:bg-surface-300 hocus:text-content-300 hocus:border-frame-300',
          'data-active:bg-surface-300 data-active:border-frame-300'
        )}
        title='Menu'
        aria-label='Menu'
      >
        <MenuIcon fontSize='small' />
      </MenuButton>

      <MainMenuItems>
        {selectedMenu == null && (
          <>
            {menus.map((menu) => (
              <MainMenuButton key={menu.id} onClick={() => setMobileMenuId(menu.id)}>
                <span className='grow'>{menu.label}</span>
                <ArrowRight className='text-content-100' fontSize='small' />
              </MainMenuButton>
            ))}
          </>
        )}

        {selectedMenu != null && (
          <>
            <MainMenuButton onClick={onBack}>
              <ArrowLeft aria-hidden='true' fontSize='small' />
              <span className='grow'>{selectedMenu.label}</span>
            </MainMenuButton>

            <MainMenuSeparator />

            <MainMenuSections sections={selectedMenu.sections} dispatch={dispatchAndClose} />
          </>
        )}
      </MainMenuItems>
    </>
  )
}

const MainMenuSections: FunctionComponent<{
  sections: readonly MenuSection[]
  dispatch: DispatchCommand
}> = ({ sections, dispatch }) => {
  return (
    <>
      {sections.map((section, sectionIndex) => (
        <Fragment key={sectionIndex}>
          {sectionIndex > 0 && <MainMenuSeparator />}

          {section.items.map((item) => (
            <MainMenuItem key={item.commandId} commandId={item.commandId} dispatch={dispatch}>
              {item.label}
            </MainMenuItem>
          ))}
        </Fragment>
      ))}
    </>
  )
}

const MainMenuItems: FunctionComponent<PropsWithChildren> = ({ children }) => {
  return (
    <MenuItems
      as='div'
      className='z-50 absolute top-full left-0 w-56 rounded-md p-1 bg-surface-200 border border-frame-200 shadow-lg outline-none'
    >
      {children}
    </MenuItems>
  )
}

const MainMenuSeparator: FunctionComponent = () => {
  return (
    <MenuSeparator as='div' className='my-1 border-t border-frame-200' />
  )
}

const MainMenuItem: FunctionComponent<PropsWithChildren<{
  commandId: CommandId
  dispatch: DispatchCommand
}>> = ({ children, commandId, dispatch }) => {
  const { getCommandById } = useCommandRegistry()

  const command = getCommandById(commandId)
  const shortcut = command?.keyboardShortcuts?.at(0)

  const onClick = useCallback(() => {
    if (command != null) {
      dispatch(command)
    }
  }, [command, dispatch])

  return (
    <MenuItem as={MainMenuButton} onClick={onClick}>
      <div className='grow'>{children}</div>

      {shortcut != null && (
        <ShortcutKeys shortcut={shortcut} />
      )}
    </MenuItem>
  )
}

const MainMenuButton: FunctionComponent<PropsWithChildren<{
  onClick: () => void
}>> = ({ children, onClick }) => {
  return (
    <button
      type='button'
      className='flex items-center gap-2 w-full text-left px-2 py-1 leading-tight rounded-md cursor-pointer text-content-200 hocus:bg-surface-300 hocus:text-content-300 outline-none'
      onClick={onClick}
    >
      {children}
    </button>
  )
}
