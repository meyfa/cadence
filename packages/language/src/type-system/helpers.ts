import type { Parameter, RelativeCurve } from '@meyfa/cadence-core'
import type { RuntimeNumeric, Unit } from '@meyfa/cadence-utility'
import type { Function } from './base/function.ts'
import { FunctionFacet } from './base/function.ts'
import type { Module } from './base/module.ts'
import { ModuleFacet } from './base/module.ts'
import { NumberFacet } from './base/number.ts'
import { RecordFacet } from './base/record.ts'
import { CurveFacet } from './domain/curve.ts'
import { ParameterFacet } from './domain/parameter.ts'
import { makeType } from './factory.ts'
import type { Schema } from './schema.ts'
import type { Facet, FacetType, Value } from './types.ts'

export const Functions = {
  of: <const S extends Schema, const R extends FacetType, const Context> (value: Function<S, R, Context>): Value => {
    const type = FunctionFacet.with({
      parameters: value.parameters,
      returnType: value.returnType,
      effects: value.effects,
      check: value.check
    }).type()

    return type.of(value)
  }
}

export const Modules = {
  of: (value: Module): Value => {
    const exportTypes: Record<string, FacetType> = Object.create(null)
    const exportValues: Record<string, Value> = Object.create(null)

    for (const [name, exportValue] of value.exports) {
      exportTypes[name] = exportValue.type
      exportValues[name] = exportValue
    }

    return makeType(
      ModuleFacet.with(value),
      RecordFacet.with(exportTypes)
    ).of(
      value,
      exportValues
    )
  }
}

export const Numbers = {
  of: <const U extends Unit> (value: RuntimeNumeric<U>): Value<Facet<'number', RuntimeNumeric<U>>> => {
    return NumberFacet.with(value.unit).type().of(value)
  }
}

export const Parameters = {
  of: <const U extends Unit> (value: Parameter<U>): Value<Facet<'parameter', Parameter<U>>> => {
    return ParameterFacet.with(value.unit).type().of(value)
  }
}

export const Curves = {
  of: <const U extends Unit> (value: RelativeCurve<U>): Value<Facet<'curve', RelativeCurve<U>>> => {
    return CurveFacet.with(value.unit).type().of(value)
  }
}
