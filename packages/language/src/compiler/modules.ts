import { effectsModule } from './modules/effects.js'
import { instrumentsModule } from './modules/instruments.js'
import { patternsModule } from './modules/patterns.js'
import type { ModuleValue, Value } from './types.js'

export interface ModuleDefinition {
  readonly name: string
  readonly exports: ReadonlyMap<string, Value>
}

const standardLibrary = Object.freeze(new Map([
  ['patterns', patternsModule],
  ['instruments', instrumentsModule],
  ['effects', effectsModule]
]))

export const standardLibraryModuleNames: ReadonlySet<string> = Object.freeze(new Set(standardLibrary.keys()))

export function getStandardModule (name: string): ModuleValue | undefined {
  return standardLibrary.get(name)
}
