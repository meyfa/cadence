import { globalBuiltins } from '../compiler/builtins/global.ts'
import { FunctionFacet } from '../type-system/base/function.ts'
import type { Module } from '../type-system/base/module.ts'
import { ModuleFacet } from '../type-system/base/module.ts'
import type { Value } from '../type-system/types.ts'
import { getStandardModule } from './modules.ts'

export interface Documentation {
  readonly title: string
  readonly summary?: string
  readonly annotations?: readonly string[]
}

export function getGlobalDocumentation (name: string): Documentation | undefined {
  const value = globalBuiltins.get(name)
  if (value == null) {
    return undefined
  }

  return describeValue(name, value)
}

export function getModuleDocumentation (moduleName: string, exportName?: string): Documentation | undefined {
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
  return {
    title: `${name} = ${value.type.format()}`,
    summary: getValueSummary(value),
    annotations: getValueAnnotations(value)
  }
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

function getValueAnnotations (value: Value): readonly string[] | undefined {
  const annotations = []

  if (FunctionFacet.has(value)) {
    const { capabilities } = FunctionFacet.get(value)

    if (capabilities.mayBlock) {
      annotations.push('may block')
    }
  }

  return annotations.length > 0 ? annotations : undefined
}
