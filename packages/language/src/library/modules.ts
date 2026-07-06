import type { Module } from '../type-system/base/module.js'
import { ModuleFacet } from '../type-system/base/module.js'
import type { Value } from '../type-system/types.js'
import { effectsModule } from './modules/effects.js'
import { instrumentsModule } from './modules/instruments.js'
import { sourcesModule } from './modules/sources.js'

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
