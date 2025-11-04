import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import { commands, findCommandForKeyboardShortcut, useCommandContext, type Command } from '../commands.js'
import { useGlobalKeydown } from '../hooks/keyboard.js'

export const CommandPalette: FunctionComponent = () => {
  const paletteRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)

  // Close palette if focus moves outside
  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as HTMLElement | null
    if (!next || !paletteRef.current?.contains(next)) {
      setOpen(false)
    }
  }, [])

  const [search, setSearch] = useState('')

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  const searchResults = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (normalizedSearch === '') {
      return commands
    }

    // TODO fuzzy search
    return commands.filter((command) => command.label.toLowerCase().includes(normalizedSearch))
  }, [search])

  const commandContext = useCommandContext()

  const dispatchCommand = useCallback((command: Command) => {
    command.action(commandContext)
    setOpen(false)
  }, [commandContext])

  const handleInputKeydown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const firstCommand = searchResults.at(0)
      if (firstCommand != null) {
        dispatchCommand(firstCommand)
      }
    }
  }, [dispatchCommand, searchResults])

  const handleKeydown = useCallback((event: KeyboardEvent) => {
    const togglePalette = (open: boolean): void => {
      event.preventDefault()
      setOpen(open)
    }

    if (event.key === 'F1') {
      togglePalette(true)
      return
    }

    if (event.key === 'Escape') {
      togglePalette(false)
      return
    }

    const { code, shiftKey: shift, altKey: alt } = event
    const ctrl = event.ctrlKey || event.metaKey

    // For now, we require at least one modifier key to avoid interfering with typing
    if (!ctrl && !shift && !alt) {
      return
    }

    // TODO: Refactor this to use the same keyboard shortcut handling as commands
    // Note: Ctrl-Shift-P may be reserved by some browsers
    if (ctrl && code === 'KeyP') {
      togglePalette(true)
      return
    }

    const matchedCommand = findCommandForKeyboardShortcut({ code, ctrl, shift, alt })
    if (matchedCommand != null) {
      event.preventDefault()
      dispatchCommand(matchedCommand)
    }
  }, [dispatchCommand])

  useGlobalKeydown(handleKeydown)

  if (!open) {
    return null
  }

  return (
    <div
      className='pointer-events-none fixed inset-0 justify-center items-start flex p-2 z-50'
      onClick={(event) => event.target === event.currentTarget && setOpen(false)}
    >
      <div
        ref={paletteRef}
        tabIndex={-1}
        className='pointer-events-auto bg-surface-200 border border-frame-200 rounded p-2 w-full max-w-2xl shadow-lg shadow-dialog-backdrop'
        onBlur={handleBlur}
        role='dialog'
        aria-label='Command palette'
      >
        <input
          type='text'
          className={clsx(
            'w-full p-2 border border-frame-200 rounded-sm bg-surface-200 text-content-200 outline-none',
            'focus:border-frame-300 focus:bg-surface-300 focus:text-content-300'
          )}
          placeholder='Type a command...'
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleInputKeydown}
        />

        <div className='max-h-64 overflow-auto mt-2'>
          {searchResults.length === 0 && (
            <div className='p-2 leading-none text-content-100'>
              No commands found.
            </div>
          )}

          {searchResults.map((command) => (
            <SearchResult key={command.id} command={command} dispatchCommand={dispatchCommand} />
          ))}
        </div>
      </div>
    </div>
  )
}

const SearchResult: FunctionComponent<{
  command: Command
  dispatchCommand: (command: Command) => void
}> = ({ command, dispatchCommand }) => {
  // Show only the first shortcut due to space constraints
  const shortcut = command.keyboardShortcuts?.at(0)

  return (
    <button
      type='button'
      className={clsx(
        'w-full flex items-center text-start px-2 leading-none rounded cursor-pointer border border-transparent bg-surface-200 text-content-200 outline-none',
        'hocus:bg-surface-300 hocus:border-frame-300 hocus:text-content-300'
      )}
      onClick={() => dispatchCommand(command)}
    >
      <div className='grow py-2'>
        {command.label}
      </div>
      <div className='text-sm'>
        {shortcut != null && (
          <>
            {shortcut.ctrl && (<KeyboardKey isModifier>Ctrl</KeyboardKey>)}
            {shortcut.shift && (<KeyboardKey isModifier>Shift</KeyboardKey>)}
            {shortcut.alt && (<KeyboardKey isModifier>Alt</KeyboardKey>)}
            <KeyboardKey>{shortcut.code}</KeyboardKey>
          </>
        )}
      </div>
    </button>
  )
}

const KeyboardKey: FunctionComponent<PropsWithChildren<{
  isModifier?: boolean
}>> = ({ children, isModifier }) => {
  return (
    <>
      <span className='inline-block border border-frame-200 rounded px-1 py-0.5 leading-none bg-surface-200 text-content-100 font-mono'>
        {children}
      </span>
      {isModifier && (<span className='mx-1 text-content-100'>+</span>)}
    </>
  )
}
