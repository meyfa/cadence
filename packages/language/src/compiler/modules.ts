import type { FunctionDefinition } from './functions.js'
import { effectsModule } from './modules/effects.js'
import { instrumentsModule } from './modules/instruments.js'
import { patternsModule } from './modules/patterns.js'
import type { AcceptedType } from './schema.js'
import type { ModuleValue, Type, Value } from './types.js'
import { FunctionType } from './types.js'

export interface ModuleDefinition {
  readonly name: string
  readonly summary?: string
  readonly exports: ReadonlyMap<string, Value>
}

const standardLibrary = Object.freeze(new Map([
  ['patterns', patternsModule],
  ['instruments', instrumentsModule],
  ['effects', effectsModule]
]))

const standardLibraryModuleNames: ReadonlySet<string> = Object.freeze(new Set(standardLibrary.keys()))

export function getStandardModuleNames (): ReadonlySet<string> {
  return standardLibraryModuleNames
}

export function getStandardModuleValue (name: string): ModuleValue | undefined {
  return standardLibrary.get(name)
}

export function getStandardModule (name: string): ModuleDefinition | undefined {
  return standardLibrary.get(name)?.data
}

export interface Documentation {
  readonly title: string
  readonly summary?: string
}

export function getDocumentation (moduleName: string, exportName?: string): Documentation | undefined {
  const module = getStandardModule(moduleName)
  if (module == null) {
    return undefined
  }

  if (exportName == null) {
    return describeModule(module)
  }

  const value = module.exports.get(exportName)
  if (value == null) {
    return undefined
  }

  return describeValue(exportName, value)
}

function describeModule (definition: ModuleDefinition): Documentation {
  return {
    title: `module ${definition.name}`,
    summary: definition.summary
  }
}

function describeValue (name: string, value: Value): Documentation {
  if (FunctionType.is(value)) {
    return {
      title: formatFunctionSignature(name, value.data),
      summary: value.data.summary
    }
  }

  return {
    title: `${name}: ${value.type.format()}`,
    summary: getValueSummary(value)
  }
}

function formatFunctionSignature (name: string, definition: FunctionDefinition): string {
  const argumentsText = definition.arguments
    .map((argument) => `${argument.name}${argument.required ? '' : '?'}: ${formatAcceptedType(argument.type)}`)
    .join(', ')

  return `${name}(${argumentsText}) -> ${definition.returnType.format()}`
}

const isTypeArray = (type: AcceptedType): type is readonly Type[] => Array.isArray(type)

function formatAcceptedType (type: AcceptedType): string {
  if (isTypeArray(type)) {
    return type.map((option) => option.format()).join(' | ')
  }

  return type.format()
}

function getValueSummary (value: Value): string | undefined {
  const data = value.data
  if (typeof data !== 'object' || !('summary' in data)) {
    return undefined
  }

  const summary = (data as { readonly summary?: unknown }).summary
  return typeof summary === 'string' ? summary : undefined
}
