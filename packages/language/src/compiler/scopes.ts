import type { Automation, Instrument, InstrumentId, Parameter, ParameterId } from '@core'
import type { Numeric, Unit } from '@utility'
import type { GenerateOptions } from './options.js'
import type { Value } from '../type-system/types.js'

// scope aspects

export interface ParameterContext {
  readonly allocateParameter: <U extends Unit>(initial: Numeric<U>) => Parameter<U>
}

export interface InstrumentContext {
  readonly allocateInstrument: (data: Omit<Instrument, 'id'>) => Instrument
}

// scope types

export interface Scope {
  readonly top: GlobalScope
  readonly parent?: Scope

  readonly resolutions: ReadonlyMap<string, Value>
}

export interface GlobalScope extends Scope, ParameterContext, InstrumentContext {
  readonly options: GenerateOptions

  readonly buses: Map<string, Value>
  readonly instruments: Map<InstrumentId, Instrument>
  readonly automations: Map<ParameterId, Automation>
}

export interface MutableScope extends Scope {
  readonly resolutions: Map<string, Value>
}

// factory functions

export function createGlobalScope (options: GenerateOptions, initialResolutions: ReadonlyMap<string, Value>): GlobalScope {
  const scope: GlobalScope = {
    // from Scope
    get top () {
      return scope
    },
    resolutions: new Map(initialResolutions),

    // from GlobalScope
    options,
    instruments: new Map(),
    buses: new Map(),
    automations: new Map(),

    // from ParameterContext
    allocateParameter: (initial) => allocateParameter(scope, initial),

    // from InstrumentContext
    allocateInstrument: (data) => allocateInstrument(scope, data)
  }

  return scope
}

export function createLocalScope (parent: Scope): MutableScope {
  return {
    top: parent.top,
    parent,
    resolutions: new Map()
  }
}

// resolution

export function resolveInScope (scope: Scope, name: string): Value | undefined {
  let current: Scope | undefined = scope

  while (current != null) {
    const value = current.resolutions.get(name)
    if (value != null) {
      return value
    }
    current = current.parent
  }

  return undefined
}

// out-of-line implementations

function allocateParameter<U extends Unit> (scope: GlobalScope, initial: Numeric<U>): Parameter<U> {
  const currentMaxId = Math.max(0, ...Array.from(scope.automations.keys()))
  const id = (currentMaxId + 1) as ParameterId

  scope.automations.set(id, {
    parameterId: id,
    points: []
  })

  return { id, initial }
}

function allocateInstrument (scope: GlobalScope, data: Omit<Instrument, 'id'>): Instrument {
  const currentMaxId = Math.max(0, ...Array.from(scope.instruments.keys()))
  const id = (currentMaxId + 1) as InstrumentId

  const instrument = { ...data, id }
  scope.instruments.set(instrument.id, instrument)

  return instrument
}
