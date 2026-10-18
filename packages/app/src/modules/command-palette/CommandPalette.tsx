import type { Command, KeyboardShortcut } from '@meyfa/cadence-editor'
import { useGlobalEscapePress, useRegisterCommand } from '@meyfa/cadence-editor'
import { Search } from '@mui/icons-material'
import clsx from 'clsx'
import type { FunctionComponent, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ShortcutKeys } from '../../components/commands/ShortcutKeys.tsx'
import { createShowPaletteCommand } from './commands.ts'
import { useCommandSearch } from './search.ts'

export const CommandPalette: FunctionComponent = () => {
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

  const showCommand = useRegisterCommand(() => {
    return createShowPaletteCommand(showPalette)
  }, [showPalette])

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

  const searchResults = useCommandSearch(search)

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
    return (
      <ClosedCommandPalette
        shortcut={showCommand.keyboardShortcuts?.at(0)}
        onClick={showPalette}
      />
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

const ClosedCommandPalette: FunctionComponent<{
  shortcut?: KeyboardShortcut
  onClick: () => void
}> = ({ shortcut, onClick }) => {
  return (
    <button
      type='button'
      title='Open command palette'
      className={clsx(
        'px-2 h-8 cursor-pointer flex items-center justify-center gap-2 w-full text-sm whitespace-nowrap outline-none overflow-hidden',
        'bg-surface-200 text-content-200 rounded-md border border-frame-200 hocus:bg-surface-300 hocus:text-content-300'
      )}
      onClick={onClick}
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
