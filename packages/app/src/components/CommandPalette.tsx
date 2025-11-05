import { convertCodeToKey, hasModifierKey, isFunctionKey, parseKeyboardShortcut, serializeKeyboardShortcut } from '@editor/keyboard-shortcuts.js'
import clsx from 'clsx'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FunctionComponent } from 'react'
import { commands, findCommandForKeyboardShortcut, useCommandContext, type Command } from '../commands.js'
import { useGlobalKeydown } from '../hooks/keyboard.js'

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

  const handleKeydown = useCallback((event: KeyboardEvent) => {
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

  useGlobalKeydown(handleKeydown)

  if (!open) {
    return null
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
  const shortcutParts = shortcut != null ? parseKeyboardShortcut(shortcut) : undefined

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
      {shortcutParts != null && (
        <div className='text-sm'>
          {shortcutParts.map((part, index) => (
            <Fragment key={part}>
              <span className='inline-block border border-frame-200 rounded px-1 py-0.5 leading-none bg-surface-200 text-content-100 font-mono'>
                {part}
              </span>
              {index < shortcutParts.length - 1 && (
                <span className='mx-1 text-content-100'>+</span>
              )}
            </Fragment>
          ))}
        </div>
      )}
    </button>
  )
}
