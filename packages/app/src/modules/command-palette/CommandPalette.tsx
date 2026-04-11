import type { Command, CommandId } from '@editor'
import { useCommandRegistry, useGlobalEscapePress, useRegisterCommand } from '@editor'
import { Search } from '@mui/icons-material'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState, type FunctionComponent, type ReactNode } from 'react'
import { ShortcutKeys } from '../../components/commands/ShortcutKeys.js'
import { fuzzyMatch } from '../../utilities/fuzzy-match.js'

export const CommandPalette: FunctionComponent = () => {
  const { commands } = useCommandRegistry()

  const paletteRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const showPalette = useCallback(() => {
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
  }, [])

  const hidePalette = useCallback(() => {
    setOpen(false)
    setSearch('')
  }, [])

  const showCommand = useRegisterCommand(() => ({
    id: 'commands.show-all' as CommandId,
    label: 'Show all commands',
    keyboardShortcuts: [
      // Ctrl-Shift-P may be reserved by some browsers
      'Ctrl+P',
      'Ctrl+Shift+P',
      'F1'
    ],
    run: showPalette
  }), [showPalette])

  const sortedCommands = useMemo(() => {
    return [...commands].sort((a, b) => a.label.localeCompare(b.label))
  }, [commands])

  // Close palette if focus moves outside
  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as HTMLElement | null
    if (!next || !paletteRef.current?.contains(next)) {
      hidePalette()
    }
  }, [hidePalette])

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  const searchResults = useMemo<readonly SearchResult[]>(() => {
    const query = search.trim()
    if (query === '') {
      return sortedCommands.map((command) => ({ command }))
    }

    const results: SearchResult[] = []

    for (const command of sortedCommands) {
      const match = fuzzyMatch({ text: command.label, query })
      if (match != null) {
        results.push({ command, matchIndices: match.indices })
      }
    }

    return results
  }, [sortedCommands, search])

  const dispatchCommandAndClose = useCallback((command: Command) => {
    // Important: close before calling action, in case action needs to open the palette
    hidePalette()
    command.run()
  }, [hidePalette])

  const handleInputKeydown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const hasModifiers = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
    if (event.key === 'Enter' && !hasModifiers) {
      const firstCommand = searchResults.at(0)
      if (firstCommand != null) {
        dispatchCommandAndClose(firstCommand.command)
      }
    }
  }, [dispatchCommandAndClose, searchResults])

  useGlobalEscapePress((event) => {
    if (open) {
      event.preventDefault()
      hidePalette()
    }
  })

  if (!open) {
    const shortcut = showCommand.keyboardShortcuts?.at(0)

    return (
      <button
        type='button'
        title='Open command palette'
        className={clsx(
          'px-2 h-8 cursor-pointer flex items-center justify-center gap-2 w-full text-sm whitespace-nowrap outline-none overflow-hidden',
          'bg-surface-200 text-content-200 rounded-md border border-frame-200 hocus:bg-surface-300 hocus:text-content-300'
        )}
        onClick={showPalette}
      >
        <Search />
        Commands…

        {shortcut != null && (
          <div className='ml-auto hidden md:block'>
            <ShortcutKeys shortcut={shortcut} />
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
        className='pointer-events-auto bg-surface-200 border border-frame-200 rounded p-1 w-full max-w-2xl shadow-lg shadow-dialog-backdrop'
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

        <div className='max-h-64 overflow-auto mt-1' tabIndex={-1}>
          {searchResults.length === 0 && (
            <div className='p-2 leading-none text-content-100'>
              No commands found.
            </div>
          )}
          {searchResults.map(({ command, matchIndices }) => (
            <CommandPaletteItem
              key={command.id}
              command={command}
              matchIndices={matchIndices}
              dispatchCommand={dispatchCommandAndClose}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface SearchResult {
  readonly command: Command
  readonly matchIndices?: readonly number[]
}

const CommandPaletteItem: FunctionComponent<{
  command: Command
  matchIndices?: readonly number[]
  dispatchCommand: (command: Command) => void
}> = ({ command, matchIndices, dispatchCommand }) => {
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
        <HighlightedLabel label={command.label} highlightIndices={matchIndices} />
      </div>
      {shortcut != null && (<ShortcutKeys shortcut={shortcut} />)}
    </button>
  )
}

const HighlightedLabel: FunctionComponent<{
  label: string
  highlightIndices?: readonly number[]
}> = ({ label, highlightIndices }) => {
  if (highlightIndices == null || highlightIndices.length === 0) {
    return <>{label}</>
  }

  const elements: ReactNode[] = []

  const chars = label.split('')
  let lastIndex = 0

  for (const index of highlightIndices) {
    // text between highlighted characters
    if (index > lastIndex) {
      elements.push(label.slice(lastIndex, index))
    }

    // highlighted character
    elements.push(
      <span key={index} className='font-bold text-accent-200'>{chars[index]}</span>
    )

    lastIndex = index + 1
  }

  if (lastIndex < label.length) {
    elements.push(label.slice(lastIndex))
  }

  return <>{elements}</>
}
