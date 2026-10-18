import type { Command } from '@meyfa/cadence-editor'
import { useCommandRegistry } from '@meyfa/cadence-editor'
import { useMemo } from 'react'
import { fuzzyMatch } from '../../utilities/fuzzy-match.ts'

export interface SearchResult {
  readonly command: Command
  readonly matchIndices?: readonly number[]
}

export function useCommandSearch (search: string): readonly SearchResult[] {
  const commands = useSortedCommands()

  return useMemo<readonly SearchResult[]>(() => {
    const query = search.trim()
    if (query === '') {
      return commands.map((command) => ({ command }))
    }

    const results: SearchResult[] = []

    for (const command of commands) {
      const match = fuzzyMatch({ text: command.label, query })
      if (match != null) {
        results.push({ command, matchIndices: match.indices })
      }
    }

    return results
  }, [commands, search])
}

function useSortedCommands (): readonly Command[] {
  const { commands } = useCommandRegistry()

  return useMemo(() => {
    return [...commands].sort((a, b) => a.label.localeCompare(b.label))
  }, [commands])
}
