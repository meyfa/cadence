import type { Automation, Instrument, InstrumentId, Parameter, ParameterId } from '@core'
import type { Numeric, Unit } from '@utility'

export type FunctionContext = InstrumentContext & ParameterContext

export interface InstrumentContext {
  readonly instruments: Map<InstrumentId, Instrument>
}

export interface ParameterContext {
  readonly automations: Map<ParameterId, Automation>
}

export function allocateInstrument (context: InstrumentContext, data: Omit<Instrument, 'id'>): Instrument {
  const currentMaxId = Math.max(0, ...Array.from(context.instruments.keys()))
  const id = (currentMaxId + 1) as InstrumentId

  const instrument = { ...data, id }
  context.instruments.set(instrument.id, instrument)

  return instrument
}

export function allocateParameter<U extends Unit> (context: ParameterContext, initial: Numeric<U>): Parameter<U> {
  const currentMaxId = Math.max(0, ...Array.from(context.automations.keys()))
  const id = (currentMaxId + 1) as ParameterId

  context.automations.set(id, {
    parameterId: id,
    points: []
  })

  return { id, initial }
}
