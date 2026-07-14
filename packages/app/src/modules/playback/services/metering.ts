import type { EntityKey } from '@meyfa/cadence-audiograph'
import type { ServiceId } from '@meyfa/cadence-editor'
import type { Observer, UnsubscribeFn } from '@meyfa/cadence-utility'
import type { GainMeasurement } from '@meyfa/cadence-webaudio'

export const METERING_SERVICE_ID = 'playback.metering' as ServiceId

export interface MeteringService {
  readonly subscribeToGain: (key: EntityKey, observer: Observer<GainMeasurement>) => UnsubscribeFn
}
