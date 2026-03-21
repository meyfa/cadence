import { numeric } from '@core/numeric.js'
import type { Bus, BusId, Instrument, InstrumentId, MixerRouting, ParameterId, Program, Track } from '@core/program.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain } from '../src/constants.js'
import type { Node, NodeId } from '../src/graph.js'
import { createAudioGraph } from '../src/lowering.js'
import type { GainNode, IdentityNode, SampleNode } from '../src/nodes.js'

describe('lowering.ts', () => {
  it('should lower empty program correctly', () => {
    const program: Program = {
      beatsPerBar: 4,
      instruments: new Map(),
      automations: new Map(),
      track: {
        tempo: numeric('bpm', 120),
        parts: []
      },
      mixer: {
        buses: [],
        routings: []
      }
    }

    const graph = createAudioGraph(program)

    assert.strictEqual(graph.nodes.size, 1)
    assert.deepStrictEqual(graph.edges, [])

    assert.strictEqual(graph.outputIds.length, 1)

    const outputNode = graph.nodes.get(graph.outputIds[0])
    assert.strictEqual(outputNode?.type, 'identity')

    assert.strictEqual(graph.instruments.size, 0)
  })

  it('should lower a program with one instrument and one bus', () => {
    const instrumentId = 100 as InstrumentId
    const instrumentGainId = 200 as ParameterId
    const busId = 300 as BusId

    const program: Program = {
      beatsPerBar: 4,

      instruments: new Map([
        [
          instrumentId,
          {
            id: instrumentId,
            sampleUrl: 'foo.wav',
            gain: {
              id: instrumentGainId,
              initial: numeric('db', -6)
            }
          } satisfies Instrument
        ]
      ]),

      automations: new Map(),

      track: {
        tempo: numeric('bpm', 120),
        parts: []
      } satisfies Track,

      mixer: {
        buses: [
          {
            id: busId,
            name: 'Bus 1',
            effects: []
          } satisfies Bus
        ],

        routings: [
          {
            implicit: false,
            source: {
              type: 'Instrument',
              id: instrumentId
            },
            destination: {
              type: 'Bus',
              id: busId
            }
          } satisfies MixerRouting,

          {
            implicit: true,
            source: {
              type: 'Bus',
              id: busId
            },
            destination: {
              type: 'Output'
            }
          } satisfies MixerRouting
        ]
      }
    }

    const graph = createAudioGraph(program)

    function compareIds (a: Node, b: Node): number {
      return b.id - a.id
    }

    assert.deepStrictEqual([...graph.nodes.values()].sort(compareIds), [
      {
        id: 4 as NodeId,
        type: 'gain',
        gain: {
          initial: numeric(undefined, dbToGain(-6)),
          points: []
        }
      } satisfies GainNode,
      {
        id: 3 as NodeId,
        length: undefined,
        type: 'sample',
        sampleUrl: 'foo.wav',
        rootNote: 'C5'
      } satisfies SampleNode,
      {
        id: 2 as NodeId,
        type: 'identity'
      } satisfies IdentityNode,
      {
        id: 1 as NodeId,
        type: 'identity'
      } satisfies IdentityNode
    ])

    assert.deepStrictEqual(graph.edges, [
      { from: 3 as NodeId, to: 4 as NodeId },
      { from: 4 as NodeId, to: 2 as NodeId },
      { from: 2 as NodeId, to: 1 as NodeId }
    ])

    assert.deepStrictEqual(graph.outputIds, [1 as NodeId])

    assert.deepStrictEqual([...graph.instruments.entries()], [
      [instrumentId, 3 as NodeId]
    ])
  })
})
