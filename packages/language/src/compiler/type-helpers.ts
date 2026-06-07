import type { Parameter } from '@core'
import type { Numeric, Unit } from '@utility'
import type { Function } from '../type-system/base/function.js'
import { FunctionFacet } from '../type-system/base/function.js'
import type { Module } from '../type-system/base/module.js'
import { ModuleFacet } from '../type-system/base/module.js'
import { NumberFacet } from '../type-system/base/number.js'
import { RecordFacet } from '../type-system/base/record.js'
import { BusFacet } from '../type-system/domain/bus.js'
import { ParameterFacet } from '../type-system/domain/parameter.js'
import { makeType } from '../type-system/factory.js'
import type { Schema } from '../type-system/schema.js'
import type { Facet, FacetType, Value } from '../type-system/types.js'

export const Functions = {
  of: <const S extends Schema, const R extends FacetType, const Context> (value: Function<S, R, Context>): Value => {
    const type = makeType(FunctionFacet.with({
      parameters: value.parameters,
      returnType: value.returnType
    }))

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
  of: <const U extends Unit> (value: Numeric<U>): Value<Facet<'number', Numeric<U>>> => {
    return NumberFacet.with(value.unit).type().of(value)
  }
}

export const Parameters = {
  of: <const U extends Unit> (value: Parameter<U>): Value<Facet<'parameter', Parameter<U>>> => {
    return ParameterFacet.with(value.initial.unit).type().of(value)
  }
}

export const BusType = makeType(BusFacet, RecordFacet.with({
  gain: ParameterFacet.with('db').type(),
  pan: ParameterFacet.with(undefined).type()
}))
