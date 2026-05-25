import type { EntityKey } from '@audiograph'
import type { ServiceId } from '@editor'
import type { Observer, UnsubscribeFn } from '@utility'
import type { GainMeasurement } from '@webaudio'

export const METERING_SERVICE_ID = 'playback.metering' as ServiceId

export interface MeteringService {
  readonly subscribeToGain: (key: EntityKey, observer: Observer<GainMeasurement>) => UnsubscribeFn
}
