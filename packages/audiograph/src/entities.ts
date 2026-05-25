import type { BusId, InstrumentId } from '@core'
import type { Brand } from '@utility'

export type Entity = BusEntity | InstrumentEntity | OutputEntity

interface BusEntity {
  readonly type: 'bus'
  readonly id: BusId
}

interface InstrumentEntity {
  readonly type: 'instrument'
  readonly id: InstrumentId
}

interface OutputEntity {
  readonly type: 'output'
}

export type EntityKey = Brand<string, 'audiograph.EntityKey'>

export function createEntityKey (entity: Entity): EntityKey {
  if (entity.type === 'output') {
    return 'output' as EntityKey
  }

  return `${entity.type}:${entity.id}` as EntityKey
}
