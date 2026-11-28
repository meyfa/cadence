import type { Locatable } from '@meyfa/cadence-ast'

export interface Token extends Locatable {
  readonly name: string
  readonly text: string
}
