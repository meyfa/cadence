import { useCallback, useEffect, useMemo, useRef, useState, type FunctionComponent } from 'react'
import { useGlobalKeydown } from '../hooks/keyboard.js'
import clsx from 'clsx'
import { commands, useCommandContext, type Command } from '../commands.js'

export const CommandPalette: FunctionComponent = () => {
  const paletteRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)

  const handleKeydown = useCallback((event: KeyboardEvent) => {
    const handleEvent = (open: boolean): void => {
      event.preventDefault()
      setOpen(open)
    }

    if (event.key === 'F1') {
      handleEvent(true)
      return
    }

    // Note: Ctrl-Shift-P may be reserved by some browsers
    if ((event.ctrlKey || event.metaKey) && event.code === 'KeyP') {
      handleEvent(true)
      return
    }

    if (event.key === 'Escape') {
      handleEvent(false)
      return
    }
  }, [])

  useGlobalKeydown(handleKeydown)

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
            <button
              key={command.id}
              type='button'
              className={clsx(
                'w-full text-start p-2 leading-none rounded cursor-pointer border border-transparent bg-surface-200 text-content-200 outline-none',
                'hocus:bg-surface-300 hocus:border-frame-300 hocus:text-content-300'
              )}
              onClick={() => dispatchCommand(command)}
            >
              {command.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
