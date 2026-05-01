import type { Automation, Instrument, InstrumentId, Parameter, ParameterId } from '@core'
import type { Numeric, Unit } from '@utility'
import type { InferSchema, PropertySchema } from './schema.js'
import type { InstrumentValue, Type, Value } from './types.js'
import { InstrumentType } from './types.js'

export interface FunctionDefinition<S extends PropertySchema = PropertySchema, R extends Type = Type> {
  readonly arguments: S
  readonly returnType: R
  readonly invoke: FunctionHandler<S>
}

export type FunctionHandler<S extends PropertySchema> = (context: FunctionContext, args: InferSchema<S>) => Value

export interface FunctionContext {
  readonly instruments: Map<InstrumentId, Instrument>
  readonly automations: Map<ParameterId, Automation>
}

export function allocateInstrument (context: FunctionContext, data: Omit<Instrument, 'id'>): InstrumentValue {
  const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
  const id = (currentMaxId + 1) as InstrumentId

  const instrument = InstrumentType.of({ ...data, id })
  context.instruments.set(instrument.data.id, instrument.data)

  return instrument
}

export function allocateParameter<U extends Unit> (context: FunctionContext, initial: Numeric<U>): Parameter<U> {
  const currentMaxId = Math.max(0, ...Array.from(context.automations.keys()))
  const id = (currentMaxId + 1) as ParameterId

  context.automations.set(id, {
    parameterId: id,
    points: []
  })

  return { id, initial }
}
