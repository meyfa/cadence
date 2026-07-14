import type { SourceRange } from '@meyfa/cadence-ast'
import { getEmptySourceRange } from '@meyfa/cadence-ast'
import { CompileError } from '../error.ts'

export interface Bus {
  readonly name: string
  readonly sources: readonly string[]
  readonly range: SourceRange
}

export function checkCyclicRoutings (buses: readonly Bus[]): CompileError[] {
  const busRanges = new Map<string, SourceRange>(
    buses.map((bus) => [bus.name, bus.range])
  )
  const busIndex = new Map<string, number>(
    buses.map((bus, index) => [bus.name, index])
  )

  const graph = new Map<string, readonly string[]>(
    // Keep only sources that refer to defined buses.
    buses.map((bus) => [
      bus.name,
      bus.sources.filter((name) => busRanges.has(name))
    ])
  )

  const errors: CompileError[] = []
  const seenCycles = new Set<string>()
  const path: string[] = []
  const pathMembers = new Set<string>()

  const visit = (start: string, node: string, startIndex: number): void => {
    path.push(node)
    pathMembers.add(node)

    for (const neighbor of graph.get(node) ?? []) {
      if (neighbor === start) {
        const key = getCycleKey(path, busIndex)
        if (!seenCycles.has(key)) {
          seenCycles.add(key)
          errors.push(getCycleError(path, busRanges))
        }
        continue
      }

      if ((busIndex.get(neighbor) ?? -1) < startIndex || pathMembers.has(neighbor)) {
        continue
      }

      visit(start, neighbor, startIndex)
    }

    path.pop()
    pathMembers.delete(node)
  }

  for (const [start, startIndex] of busIndex) {
    visit(start, start, startIndex)
  }

  return errors.sort((a, b) => (a.range?.offset ?? 0) - (b.range?.offset ?? 0))
}

function getCycleKey (members: readonly string[], indices: ReadonlyMap<string, number>): string {
  return [...members]
    .sort((left, right) => (indices.get(left) ?? 0) - (indices.get(right) ?? 0))
    .join('\0')
}

function getCycleError (members: readonly string[], ranges: ReadonlyMap<string, SourceRange>): CompileError {
  const initialRange = ranges.get(members[0]) ?? getEmptySourceRange()

  const range = members.reduce((previous, member) => {
    const range = ranges.get(member)
    return range != null && range.offset < previous.offset ? range : previous
  }, initialRange)

  // We have traversed the cycle from targets to sources, so reverse it for the error message.
  // The first member is repeated at the end to make the cycle explicit.
  const path = members.length === 0
    ? []
    : [members[0], ...members.slice(1).reverse(), members[0]]

  const pathString = path.join(' -> ')

  return new CompileError(`Cyclic routing: ${pathString}`, range)
}
