import type { FunctionDefinition } from './functions.js'
import { getStandardModule, type ModuleDefinition } from './modules.js'
import type { AcceptedType } from './schema.js'
import { FunctionType } from './types.js'
import type { Type, Value } from './types.js'

export interface HoverInfo {
  readonly title: string
  readonly summary?: string
}

export function getStandardLibraryHoverInfo (moduleName: string, exportName?: string): HoverInfo | undefined {
  const module = getStandardModule(moduleName)
  if (module == null) {
    return undefined
  }

  if (exportName == null) {
    return describeModule(module.data)
  }

  const value = module.data.exports.get(exportName)
  return value == null ? undefined : describeValue(exportName, value)
}

function describeModule (definition: ModuleDefinition): HoverInfo {
  return {
    title: `module ${definition.name}`,
    summary: definition.summary
  }
}

function describeValue (name: string, value: Value): HoverInfo {
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

function formatAcceptedType (type: AcceptedType): string {
  if (isTypeArray(type)) {
    return type.map((option) => option.format()).join(' | ')
  }

  return type.format()
}

function isTypeArray (type: AcceptedType): type is readonly Type[] {
  return Array.isArray(type)
}

function getValueSummary (value: Value): string | undefined {
  const data = value.data
  if (typeof data !== 'object' || !('summary' in data)) {
    return undefined
  }

  const summary = (data as { readonly summary?: unknown }).summary
  return typeof summary === 'string' ? summary : undefined
}
