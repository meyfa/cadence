import type { Transport } from '../transport.js'
import type { Instance } from './types.js'
import type { IdentityNode } from '@audiograph/nodes.js'

export function createIdentityInstance (node: IdentityNode, transport: Transport): Instance {
  const audioNode = transport.ctx.createGain()

  return {
    loaded: Promise.resolve(),
    dispose: () => {
      audioNode.disconnect()
    },
    input: audioNode,
    output: audioNode
  }
}
