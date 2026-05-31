import type { OscillatorNode } from '@audiograph'
import { getMidiFrequency } from '@core'
import type { Transport } from '../../transport/transport.js'
import type { Instance } from '../instance.js'
import type { CreateSource } from './common.js'
import { createInstrumentInstance } from './common.js'

const oscillatorTypeMap: Record<OscillatorNode['shape'], OscillatorType> = {
  sine: 'sine',
  square: 'square',
  saw: 'sawtooth',
  triangle: 'triangle'
}

export async function createOscillatorInstance (node: OscillatorNode, transport: Transport): Promise<Instance> {
  const { ctx } = transport

  const createSource: CreateSource = (note) => {
    const oscillator = ctx.createOscillator()
    oscillator.type = oscillatorTypeMap[node.shape]
    oscillator.frequency.value = getMidiFrequency(note.pitch ?? node.rootNote)
    return oscillator
  }

  return createInstrumentInstance(transport, createSource, {
    envelope: node.envelope,
    rootNote: node.rootNote,
    length: undefined
  })
}
