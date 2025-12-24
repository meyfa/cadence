import { convertCodeToKey, hasModifierKey, isFunctionKey, parseKeyboardShortcut, serializeKeyboardShortcut, type KeyboardShortcut } from '@editor/keyboard-shortcuts.js'
import { Search } from '@mui/icons-material'
import clsx from 'clsx'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FunctionComponent } from 'react'
import { CommandId, commands, findCommandForKeyboardShortcut, getCommandById, useCommandContext, type Command } from '../commands.js'
import { useGlobalKeydown } from '../hooks/input.js'

export const CommandPalette: FunctionComponent = () => {
  const paletteRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const showCommandPalette = useCallback(() => {
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const hideCommandPalette = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  const showCommand = useMemo(() => getCommandById(CommandId.CommandsShowAll), [])

  // Close palette if focus moves outside
  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as HTMLElement | null
    if (!next || !paletteRef.current?.contains(next)) {
      hideCommandPalette()
    }
  }, [hideCommandPalette])

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

  const commandContext = useCommandContext({ showCommandPalette })

  const dispatchCommand = useCallback((command: Command) => {
    // Important: close before calling action, in case action needs to open the palette
    hideCommandPalette()
    command.action(commandContext)
  }, [commandContext, hideCommandPalette])

  const handleInputKeydown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const hasModifiers = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
    if (event.key === 'Enter' && !hasModifiers) {
      const firstCommand = searchResults.at(0)
      if (firstCommand != null) {
        dispatchCommand(firstCommand)
      }
    }
  }, [dispatchCommand, searchResults])

  useGlobalKeydown((event) => {
    const { code, shiftKey: shift, altKey: alt } = event
    const ctrl = event.ctrlKey || event.metaKey

    const keyboardShortcut = serializeKeyboardShortcut({ code, ctrl, shift, alt })

    if (open && keyboardShortcut === 'Escape') {
      event.preventDefault()
      hideCommandPalette()
      return
    }

    // Avoid interfering with typing
    if (!hasModifierKey(keyboardShortcut) && !isFunctionKey(convertCodeToKey(code))) {
      return
    }

    const matchedCommand = findCommandForKeyboardShortcut(keyboardShortcut)
    if (matchedCommand != null) {
      event.preventDefault()
      dispatchCommand(matchedCommand)
    }
  }, [open, dispatchCommand, hideCommandPalette])

  if (!open) {
    const shortcut = showCommand?.keyboardShortcuts?.at(0)

    return (
      <button
        type='button'
        title='Open command palette'
        className={clsx(
          'px-2 h-8 cursor-pointer flex items-center justify-center gap-2 w-full text-sm whitespace-nowrap outline-none overflow-hidden',
          'bg-surface-200 text-content-200 rounded-md border border-frame-200 hocus:bg-surface-300 hocus:text-content-300'
        )}
        onClick={showCommandPalette}
      >
        <Search />
        Commands…

        {shortcut != null && (
          <div className='ml-auto hidden md:block'>
            <KeyboardShortcut shortcut={shortcut} />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className='pointer-events-none fixed inset-0 justify-center items-start flex p-2 z-50'>
      <div
        ref={paletteRef}
        tabIndex={-1}
        className='pointer-events-auto bg-surface-200 border border-frame-200 rounded p-2 w-full max-w-2xl shadow-lg shadow-dialog-backdrop'
        onBlur={handleBlur}
        role='dialog'
        aria-label='Command palette'
      >
        <input
          ref={searchRef}
          type='text'
          className={clsx(
            'w-full px-2 py-1 border border-frame-200 rounded-sm bg-surface-200 text-content-200 outline-none',
            'focus:border-frame-300 focus:bg-surface-300 focus:text-content-300'
          )}
          placeholder='Commands…'
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
        'hocus:bg-surface-300 focus:bg-surface-300 focus:border-frame-300'
      )}
      onClick={() => dispatchCommand(command)}
    >
      <div className='grow py-1'>
        {command.label}
      </div>
      {shortcut != null && (
        <KeyboardShortcut shortcut={shortcut} />
      )}
    </button>
  )
}

const KeyboardShortcut: FunctionComponent<{
  shortcut: KeyboardShortcut
}> = ({ shortcut }) => {
  const parts = parseKeyboardShortcut(shortcut)

  return (
    <div className='flex items-center gap-0.5 text-sm'>
      {parts.map((part, index) => (
        <Fragment key={part}>
          <span className='inline-block border border-frame-200 rounded px-1 py-0.5 leading-none bg-surface-200 text-content-100 font-mono'>
            {part}
          </span>
          {index < parts.length - 1 && (
            <span className='text-content-100'>+</span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
