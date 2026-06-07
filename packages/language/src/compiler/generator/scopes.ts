import type { Automation, Bus, BusId, Instrument, InstrumentId, Parameter, ParameterId } from '@core'
import type { Numeric, Unit } from '@utility'
import type { Value } from '../../type-system/types.js'
import type { GenerateOptions } from './options.js'

// scope aspects

type Context = BusContext & ParameterContext & InstrumentContext

export interface BusContext {
  readonly allocateBus: (data: Omit<Bus, 'id'>) => Bus
}

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

export interface GlobalScope extends Scope, Context {
  readonly options: GenerateOptions

  readonly namespaces: Map<string, Namespace>

  readonly buses: Map<BusId, Bus>
  readonly instruments: Map<InstrumentId, Instrument>
  readonly automations: Map<ParameterId, Automation>
}

export interface MutableScope extends Scope {
  readonly resolutions: Map<string, Value>
}

// namespace

export interface Namespace {
  readonly resolutions: ReadonlyMap<string, Value>
}

export interface MutableNamespace extends Namespace {
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
    namespaces: new Map(),
    buses: new Map(),
    instruments: new Map(),
    automations: new Map(),

    // from BusContext
    allocateBus: (data) => allocateBus(scope, data),

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

export function createNamespace (): MutableNamespace {
  return {
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

function allocateBus (scope: GlobalScope, data: Omit<Bus, 'id'>): Bus {
  const id = scope.buses.size as BusId

  const bus = { ...data, id }
  scope.buses.set(id, bus)

  return bus
}

function allocateParameter<U extends Unit> (scope: GlobalScope, initial: Numeric<U>): Parameter<U> {
  const id = scope.automations.size as ParameterId

  scope.automations.set(id, {
    parameterId: id,
    points: []
  })

  return { id, initial }
}

function allocateInstrument (scope: GlobalScope, data: Omit<Instrument, 'id'>): Instrument {
  const id = scope.instruments.size as InstrumentId

  const instrument = { ...data, id }
  scope.instruments.set(instrument.id, instrument)

  return instrument
}
