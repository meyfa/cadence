import type { Unit } from '@meyfa/cadence-utility'
import type { Curve } from '../curve/types.js'
import type { Asset, AssetId } from './assets.js'
import type { ParameterId } from './automations.js'
import type { Instrument, InstrumentId } from './instruments.js'
import type { Mixer } from './mixer.js'
import type { Track } from './track.js'

export interface Program {
  readonly beatsPerBar: number

  readonly instruments: ReadonlyMap<InstrumentId, Instrument>
  readonly assets: ReadonlyMap<AssetId, Asset>
  readonly automations: ReadonlyMap<ParameterId, Curve<'s', Unit>>

  readonly track: Track
  readonly mixer: Mixer
}
