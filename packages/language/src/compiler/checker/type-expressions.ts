import type { ast, SourceRange } from '@meyfa/cadence-ast'
import { FunctionFacet } from '../../type-system/base/function.ts'
import { RecordFacet } from '../../type-system/base/record.ts'
import { makeFacetType } from '../../type-system/factory.ts'
import type { Facet, Type } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { checkParameters } from './parameters.ts'
import { getFacet } from './type-facets.ts'

export interface CheckedType {
  readonly errors: readonly CompileError[]
  readonly result?: Type
}

export function checkType (expression: ast.Type): CheckedType {
  const errors: CompileError[] = []

  const facetsCheck = checkFacets(expression)
  errors.push(...facetsCheck.errors)
  if (facetsCheck.errors.length > 0) {
    return { errors }
  }

  if (facetsCheck.facets.length === 0) {
    errors.push(new CompileError('Cannot combine zero types', expression.range))
    return { errors }
  }

  const facets = new Map<string, Facet>()

  for (const { facet, range } of facetsCheck.facets) {
    const existing = facets.get(facet.name)
    if (existing != null) {
      const merged = existing.merge(facet)
      if (merged == null) {
        errors.push(new CompileError(`Type conflict: (${existing.format()}) + (${facet.format()})`, range))
        continue
      }

      facets.set(merged.name, merged)
      continue
    }

    facets.set(facet.name, facet)
  }

  const result = makeFacetType(...facets.values())

  return { errors, result }
}

interface CheckedFacets {
  readonly errors: readonly CompileError[]
  readonly facets: readonly FacetWithRange[]
}

interface FacetWithRange {
  readonly facet: Facet
  readonly range: SourceRange
}

function checkFacets (expression: ast.Type): CheckedFacets {
  switch (expression.type) {
    case 'NamedType':
      return checkNamedType(expression)

    case 'FunctionType':
      return checkFunctionType(expression)

    case 'RecordType':
      return checkRecordType(expression)

    case 'CombinedType':
      return checkCombinedType(expression)
  }
}

function checkNamedType (expression: ast.NamedType): CheckedFacets {
  const errors: CompileError[] = []
  const facets: FacetWithRange[] = []

  if (expression.generics.length > 1) {
    errors.push(new CompileError('Types can have at most one generic', expression.range))
    return { errors, facets }
  }

  const generic = expression.generics.at(0)?.name
  const facet = getFacet(expression.name.name, generic)

  if (facet == null) {
    const typeName = generic != null ? `${expression.name.name}.${generic}` : expression.name.name
    errors.push(new CompileError(`Unknown type "${typeName}"`, expression.range))
    return { errors, facets }
  }

  facets.push({ facet, range: expression.range })

  return { errors, facets }
}

function checkFunctionType (expression: ast.FunctionType): CheckedFacets {
  const errors: CompileError[] = []
  const facets: FacetWithRange[] = []

  const parameterCheck = checkParameters(expression.parameters)
  errors.push(...parameterCheck.errors)

  const returnTypeCheck = checkType(expression.returnType)
  errors.push(...returnTypeCheck.errors)

  const capabilityAnnotations = new Set<string>()

  for (const capability of expression.capabilities) {
    if (capability.name !== 'may_block') {
      errors.push(new CompileError(`Unknown capability "${capability.name}"`, capability.range))
      continue
    }

    if (capabilityAnnotations.has(capability.name)) {
      errors.push(new CompileError(`Duplicate capability "${capability.name}"`, capability.range))
      continue
    }

    capabilityAnnotations.add(capability.name)
  }

  if (parameterCheck.errors.length > 0 || returnTypeCheck.result == null) {
    return { errors, facets }
  }

  const facet = FunctionFacet.with({
    parameters: parameterCheck.schema,
    returnType: returnTypeCheck.result,
    capabilities: {
      mayBlock: capabilityAnnotations.has('may_block')
    }
  })

  facets.push({ facet, range: expression.range })

  return { errors, facets }
}

function checkRecordType (expression: ast.RecordType): CheckedFacets {
  const errors: CompileError[] = []
  const facets: FacetWithRange[] = []

  const properties: Record<string, Type> = Object.create(null)

  for (const property of expression.properties) {
    const propertyCheck = checkType(property.propertyType)
    errors.push(...propertyCheck.errors)

    if (propertyCheck.result == null) {
      continue
    }

    if (Object.hasOwn(properties, property.name.name)) {
      errors.push(new CompileError(`Duplicate property name "${property.name.name}"`, property.name.range))
      continue
    }

    properties[property.name.name] = propertyCheck.result
  }

  const facet = RecordFacet.with(properties)
  facets.push({ facet, range: expression.range })

  return { errors, facets }
}

function checkCombinedType (expression: ast.CombinedType): CheckedFacets {
  const errors: CompileError[] = []
  const facets: FacetWithRange[] = []

  for (const child of expression.children) {
    const childCheck = checkFacets(child)
    errors.push(...childCheck.errors)
    facets.push(...childCheck.facets)
  }

  return { errors, facets }
}
