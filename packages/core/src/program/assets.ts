import type { Brand } from '@meyfa/cadence-utility'

export type AssetId = Brand<number, 'core.AssetId'>

export interface Asset {
  readonly id: AssetId
  readonly url: string
}
