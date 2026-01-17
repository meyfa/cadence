import { type Instrument, type InstrumentId } from '@core/program.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { type Type, type Value } from './types.js'

export interface FunctionDefinition<S extends PropertySchema = PropertySchema, R extends Type = Type> {
  readonly arguments: S
  readonly returnType: R
  readonly invoke: FunctionHandler<S>
}

export type FunctionHandler<S extends PropertySchema> = (context: FunctionContext, args: InferSchema<S>) => Value

export interface FunctionContext {
  readonly instruments: Map<InstrumentId, Instrument>
}
