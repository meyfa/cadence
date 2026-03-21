import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport.js'
import { createEffectInstance } from './effect.js'
import { createIdentityInstance } from './identity.js'
import { createSampleInstance } from './sample.js'
import type { Instance } from './types.js'
import type { Node } from '@audiograph/nodes.js'

export function createNodeInstance (node: Node, transport: Transport, fetcher: AudioFetcher): Instance {
  switch (node.type) {
    case 'identity':
      return createIdentityInstance(node, transport)

    case 'gain':
    case 'pan':
    case 'biquad':
    case 'delay':
    case 'reverb':
      return createEffectInstance(node, transport)

    case 'sample':
      return createSampleInstance(node, transport, fetcher)
  }
}
