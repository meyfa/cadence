import type { Function } from '../type-system/base/function.js'
import { FunctionFacet } from '../type-system/base/function.js'
import type { Module } from '../type-system/base/module.js'
import { ModuleFacet } from '../type-system/base/module.js'
import type { Value } from '../type-system/types.js'
import { getStandardModule } from './modules.js'

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

function describeModule (definition: Module): Documentation {
  return {
    title: `module ${definition.name}`,
    summary: definition.summary
  }
}

function describeValue (name: string, value: Value): Documentation {
  if (FunctionFacet.has(value)) {
    const functionValue = FunctionFacet.get(value)

    return {
      title: formatFunctionSignature(name, functionValue),
      summary: functionValue.summary
    }
  }

  return {
    title: `${name}: ${value.type.format()}`,
    summary: getValueSummary(value)
  }
}

function formatFunctionSignature (name: string, functionValue: Function): string {
  const parametersText = functionValue.parameters.items
    .map((parameter) => `${parameter.name}${parameter.required ? '' : '?'}: ${parameter.type.format()}`)
    .join(', ')

  return `${name}(${parametersText}) -> ${functionValue.returnType.format()}`
}

function getValueSummary (value: Value): string | undefined {
  if (ModuleFacet.has(value)) {
    return ModuleFacet.get(value).summary
  }

  if (FunctionFacet.has(value)) {
    return FunctionFacet.get(value).summary
  }

  return undefined
}
