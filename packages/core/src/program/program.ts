import type { Unit } from '@meyfa/cadence-utility'
import type { Curve } from '../curve/types.ts'
import type { Asset, AssetId } from './assets.ts'
import type { ParameterId } from './automations.ts'
import type { Instrument, InstrumentId } from './instruments.ts'
import type { Mixer } from './mixer.ts'
import type { Track } from './track.ts'

export interface Program {
  readonly beatsPerBar: number

  readonly instruments: ReadonlyMap<InstrumentId, Instrument>
  readonly assets: ReadonlyMap<AssetId, Asset>
  readonly automations: ReadonlyMap<ParameterId, Curve<'s', Unit>>

  readonly track: Track
  readonly mixer: Mixer
}
