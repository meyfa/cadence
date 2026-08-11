import type { ast } from '@meyfa/cadence-ast'
import { getStandardModuleNames, getStandardModuleValue } from '../../library/modules.ts'
import { ModuleFacet } from '../../type-system/base/module.ts'
import type { Value } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import type { Binding } from './scopes.ts'

export interface CheckedImports {
  readonly errors: readonly CompileError[]
  readonly result: ReadonlyMap<string, Binding>
}

export function checkImports (imports: readonly ast.Import[]): CheckedImports {
  const standardLibraryModuleNames = getStandardModuleNames()

  const errors: CompileError[] = []

  const defaults = new Set<string>()
  const aliases = new Map<string, string>()

  for (const statement of imports) {
    if (!statement.library.parts.every((part) => typeof part === 'string')) {
      errors.push(new CompileError(`Imports cannot use string interpolation`, statement.library.range))
      continue
    }

    const libraryName = statement.library.parts.join('')

    if (!standardLibraryModuleNames.has(libraryName)) {
      errors.push(new CompileError(`Unknown module "${libraryName}"`, statement.range))
      continue
    }

    if (statement.alias == null) {
      if (defaults.has(libraryName)) {
        errors.push(new CompileError(`Duplicate import of "${libraryName}"`, statement.range))
      }

      defaults.add(libraryName)
      continue
    }

    if (aliases.has(statement.alias)) {
      errors.push(new CompileError(`Duplicate import alias "${statement.alias}"`, statement.range))
      continue
    }

    aliases.set(statement.alias, libraryName)
  }

  const result = new Map<string, Binding>()

  if (errors.length > 0) {
    return { errors, result }
  }

  // defaults must come before aliases to allow aliasing over default imports
  for (const importName of defaults) {
    const module = ensureStandardModule(importName)
    for (const [name, { type }] of ModuleFacet.get(module).exports.entries()) {
      result.set(name, { name, type, definite: true })
    }
  }

  for (const [alias, importName] of aliases) {
    const { type } = ensureStandardModule(importName)
    result.set(alias, { name: alias, type, definite: true })
  }

  return { errors, result }
}

function ensureStandardModule (moduleName: string): Value<typeof ModuleFacet> {
  const module = getStandardModuleValue(moduleName)
  if (module == null) {
    throw new Error(`Missing standard library module: ${moduleName}`)
  }

  return module
}
