import type { OscillatorNode } from '@audiograph'
import type { Transport } from '../../transport/transport.js'
import type { Instance } from '../instance.js'

const oscillatorTypeMap: Record<OscillatorNode['shape'], OscillatorType> = {
  sine: 'sine',
  square: 'square',
  saw: 'sawtooth',
  triangle: 'triangle'
}

export function createOscillatorInstance (node: OscillatorNode, transport: Transport): Instance {
  const audioNode = createOscillatorSource(node, transport)

  return {
    input: audioNode,
    output: audioNode,
    dispose: () => {
      audioNode.disconnect()
    }
  }
}

export function createOscillatorSource (
  node: OscillatorNode,
  transport: Transport
): AudioScheduledSourceNode {
  const oscillator = transport.ctx.createOscillator()
  oscillator.type = oscillatorTypeMap[node.shape]
  oscillator.frequency.value = node.frequency

  return oscillator
}
