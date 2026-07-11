import type { Asset, AssetId, Bus, BusId, Curve, Instrument, InstrumentId, Parameter, ParameterId } from '@core'
import type { Numeric, Unit } from '@utility'
import type { Value } from '../../type-system/types.js'
import type { GenerateOptions } from './options.js'

// scope aspects

type Context = BusContext & ParameterContext & InstrumentContext & AssetContext

export interface BusContext {
  readonly allocateBus: (data: Omit<Bus, 'id'>) => Bus
}

export interface ParameterContext {
  readonly allocateParameter: <U extends Unit>(initial: Numeric<U>) => Parameter<U>
}

export interface InstrumentContext {
  readonly allocateInstrument: (data: Omit<Instrument, 'id'>) => Instrument
}

export interface AssetContext {
  readonly allocateAsset: (data: Omit<Asset, 'id'>) => Asset
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
  readonly automations: Map<ParameterId, Curve<'s', Unit>>
  readonly assets: Map<AssetId, Asset>
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
    assets: new Map(),

    // from BusContext
    allocateBus: (data) => allocateBus(scope, data),

    // from ParameterContext
    allocateParameter: (initial) => allocateParameter(scope, initial),

    // from InstrumentContext
    allocateInstrument: (data) => allocateInstrument(scope, data),

    // from AssetContext
    allocateAsset: (data) => allocateAsset(scope, data)
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

export function cloneScope (scope: Scope): MutableScope {
  return {
    top: scope.top,
    parent: scope.parent,
    resolutions: new Map(scope.resolutions)
  }
}

export function createNamespace (): MutableNamespace {
  return {
    resolutions: new Map()
  }
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
  scope.automations.set(id, { initial, points: [] })

  return { id, initial }
}

function allocateInstrument (scope: GlobalScope, data: Omit<Instrument, 'id'>): Instrument {
  const id = scope.instruments.size as InstrumentId

  const instrument = { ...data, id }
  scope.instruments.set(instrument.id, instrument)

  return instrument
}

function allocateAsset (scope: GlobalScope, data: Omit<Asset, 'id'>): Asset {
  const id = scope.assets.size as AssetId

  const asset = { ...data, id }
  scope.assets.set(asset.id, asset)

  return asset
}
