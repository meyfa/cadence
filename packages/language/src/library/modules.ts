import type { Module } from '../type-system/base/module.ts'
import { ModuleFacet } from '../type-system/base/module.ts'
import type { Value } from '../type-system/types.ts'
import { effectsModule } from './modules/effects.ts'
import { instrumentsModule } from './modules/instruments.ts'
import { sourcesModule } from './modules/sources.ts'

const standardLibrary = Object.freeze(new Map([
  ['sources', sourcesModule],
  ['instruments', instrumentsModule],
  ['effects', effectsModule]
]))

const standardLibraryModuleNames: ReadonlySet<string> = Object.freeze(new Set(standardLibrary.keys()))

export function getStandardModuleNames (): ReadonlySet<string> {
  return standardLibraryModuleNames
}

export function getStandardModuleValue (name: string): Value<typeof ModuleFacet> | undefined {
  const value = standardLibrary.get(name)
  if (value == null) {
    return undefined
  }

  return value as Value<typeof ModuleFacet>
}

export function getStandardModule (name: string): Module | undefined {
  const value = getStandardModuleValue(name)
  if (value == null) {
    return undefined
  }

  return ModuleFacet.get(value)
}
