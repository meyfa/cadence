import type { MidiNote } from '@core/midi.js'
import { numeric } from '@core/numeric.js'
import { createSerialPattern } from '@core/pattern.js'
import type { Bus, BusId, Effect, Instrument, InstrumentId, InstrumentRouting, MixerRouting, ParameterId, Program, Track } from '@core/program.js'
import { beatsToSeconds } from '@core/time.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain } from '../src/constants.js'
import type { NodeId } from '../src/graph.js'
import { createAudioGraph } from '../src/lowering.js'
import type { DelayNode, GainNode, IdentityNode, Node, ReverbNode, SampleNode } from '../src/nodes.js'

function compareIds (a: Node, b: Node): number {
  return a.id - b.id
}

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

    assert.strictEqual(graph.noteEvents.size, 0)
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

    assert.deepStrictEqual([...graph.nodes.values()].sort(compareIds), [
      {
        id: 1 as NodeId,
        type: 'identity'
      } satisfies IdentityNode,
      {
        id: 2 as NodeId,
        type: 'identity'
      } satisfies IdentityNode,
      {
        id: 3 as NodeId,
        length: undefined,
        type: 'sample',
        sampleUrl: 'foo.wav',
        rootNote: 72 as MidiNote // C5
      } satisfies SampleNode,
      {
        id: 4 as NodeId,
        type: 'gain',
        gain: {
          initial: numeric(undefined, dbToGain(-6)),
          points: []
        }
      } satisfies GainNode
    ])

    assert.deepStrictEqual(graph.edges, [
      { from: 3 as NodeId, to: 4 as NodeId },
      { from: 4 as NodeId, to: 2 as NodeId },
      { from: 2 as NodeId, to: 1 as NodeId }
    ])

    assert.deepStrictEqual(graph.outputIds, [1 as NodeId])
    assert.deepStrictEqual(graph.noteEvents.size, 0)
  })

  it('should automate instrument gain', () => {
    const instrumentId = 100 as InstrumentId
    const instrumentGainId = 200 as ParameterId

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

      automations: new Map([
        [
          instrumentGainId,
          {
            parameterId: instrumentGainId,
            type: 'gain',
            points: [
              {
                time: numeric('beats', 1),
                value: numeric('db', -3),
                curve: 'linear'
              },
              {
                time: numeric('beats', 2),
                value: numeric('db', -12),
                curve: 'step'
              }
            ]
          }
        ]
      ]),

      track: {
        tempo: numeric('bpm', 120),
        parts: []
      } satisfies Track,

      mixer: {
        buses: [],
        routings: [
          {
            implicit: true,
            source: {
              type: 'Instrument',
              id: instrumentId
            },
            destination: {
              type: 'Output'
            }
          } satisfies MixerRouting
        ]
      }
    }

    const graph = createAudioGraph(program)

    assert.deepStrictEqual(graph.nodes.get(3 as NodeId), {
      id: 3 as NodeId,
      type: 'gain',
      gain: {
        initial: numeric(undefined, dbToGain(-6)),
        points: [
          {
            time: numeric('s', 0.5),
            value: numeric(undefined, dbToGain(-3)),
            curve: 'exponential'
          },
          {
            time: numeric('s', 1),
            value: numeric(undefined, dbToGain(-12)),
            curve: 'step'
          }
        ]
      }
    } satisfies GainNode)
  })

  it('should produce note events for an instrument', () => {
    const instrumentId = 100 as InstrumentId

    const program: Program = {
      beatsPerBar: 4,

      instruments: new Map([
        [
          instrumentId,
          {
            id: instrumentId,
            sampleUrl: 'foo.wav',
            gain: {
              id: 200 as ParameterId,
              initial: numeric('db', -6)
            }
          } satisfies Instrument
        ]
      ]),

      automations: new Map(),

      track: {
        tempo: numeric('bpm', 120),
        parts: [
          {
            name: 'Part 1',
            length: numeric('beats', 4),
            routings: [
              {
                source: {
                  type: 'Pattern',
                  value: createSerialPattern([{ value: 'C4' }, { value: 'E4' }], 1)
                },
                destination: {
                  type: 'Instrument',
                  id: instrumentId
                }
              } satisfies InstrumentRouting
            ]
          },
          {
            name: 'Part 1',
            length: numeric('beats', 4),
            routings: [
              {
                source: {
                  type: 'Pattern',
                  value: createSerialPattern([{ value: 'G4' }, { value: 'B4' }], 1)
                },
                destination: {
                  type: 'Instrument',
                  id: instrumentId
                }
              } satisfies InstrumentRouting
            ]
          }
        ]
      },

      mixer: {
        buses: [],
        routings: []
      }
    }

    const graph = createAudioGraph(program)

    assert.deepStrictEqual([...graph.noteEvents.entries()], [
      [
        2 as NodeId,
        [
          { time: 0, pitch: 60, velocity: 1.0, duration: 0.5 },
          { time: 0.5, pitch: 64, velocity: 1.0, duration: 0.5 },
          { time: 2, pitch: 67, velocity: 1.0, duration: 0.5 },
          { time: 2.5, pitch: 71, velocity: 1.0, duration: 0.5 }
        ]
      ]
    ])
  })

  describe('effects', () => {
    function createProgramWithEffect (effect: Effect): Program {
      return {
        beatsPerBar: 4,
        instruments: new Map(),
        automations: new Map(),
        track: {
          tempo: numeric('bpm', 120),
          parts: []
        },
        mixer: {
          buses: [
            {
              id: 100 as BusId,
              name: 'Bus 1',
              effects: [effect]
            }
          ],
          routings: [
            {
              implicit: false,
              source: {
                type: 'Bus',
                id: 100 as BusId
              },
              destination: {
                type: 'Output'
              }
            }
          ]
        }
      }
    }

    it('should handle gain', () => {
      const graph = createAudioGraph(createProgramWithEffect({
        type: 'gain',
        gain: numeric('db', -3)
      }))
      assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
        id: 2 as NodeId,
        type: 'gain',
        gain: {
          initial: numeric(undefined, dbToGain(-3)),
          points: []
        }
      } satisfies GainNode)
    })

    it('should handle pan', () => {
      const graph = createAudioGraph(createProgramWithEffect({
        type: 'pan',
        pan: numeric(undefined, 0.5)
      }))
      assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
        id: 2 as NodeId,
        type: 'pan',
        pan: numeric(undefined, 0.5)
      })
    })

    it('should handle lowpass', () => {
      const graph = createAudioGraph(createProgramWithEffect({
        type: 'lowpass',
        frequency: numeric('hz', 1000)
      }))
      assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
        id: 2 as NodeId,
        type: 'lowpass',
        frequency: numeric('hz', 1000)
      })
    })

    it('should handle highpass', () => {
      const graph = createAudioGraph(createProgramWithEffect({
        type: 'highpass',
        frequency: numeric('hz', 500)
      }))
      assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
        id: 2 as NodeId,
        type: 'highpass',
        frequency: numeric('hz', 500)
      })
    })

    it('should handle delay', () => {
      const graph = createAudioGraph(createProgramWithEffect({
        type: 'delay',
        mix: numeric(undefined, 0.25),
        time: numeric('beats', 0.5),
        feedback: numeric(undefined, 0.4)
      }))

      assert.deepStrictEqual([...graph.nodes.values()].sort(compareIds), [
        // output node
        {
          id: 1 as NodeId,
          type: 'identity'
        } satisfies IdentityNode,
        // delay node
        {
          id: 2 as NodeId,
          type: 'delay',
          time: beatsToSeconds(numeric('beats', 0.5), numeric('bpm', 120))
        } satisfies DelayNode,
        // feedback gain node
        {
          id: 3 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 0.4),
            points: []
          }
        } satisfies GainNode,
        // dry gain node
        {
          id: 4 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 1.0),
            points: []
          }
        } satisfies GainNode,
        // wet gain node
        {
          id: 5 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 0.5),
            points: []
          }
        } satisfies GainNode
      ])

      assert.deepStrictEqual(graph.edges, [
        // delay to feedback
        { from: 2 as NodeId, to: 3 as NodeId },
        // feedback to delay
        { from: 3 as NodeId, to: 2 as NodeId },
        // delay to wet
        { from: 2 as NodeId, to: 5 as NodeId },
        // input to dry
        { from: 4 as NodeId, to: 1 as NodeId },
        // wet to output
        { from: 5 as NodeId, to: 1 as NodeId }
      ])
    })

    it('should handle reverb', () => {
      const graph = createAudioGraph(createProgramWithEffect({
        type: 'reverb',
        mix: numeric(undefined, 0.75),
        decay: numeric('s', 2)
      }))

      assert.deepStrictEqual([...graph.nodes.values()].sort(compareIds), [
        // output node
        {
          id: 1 as NodeId,
          type: 'identity'
        } satisfies IdentityNode,
        // reverb node
        {
          id: 2 as NodeId,
          type: 'reverb',
          decay: numeric('s', 2)
        } satisfies ReverbNode,
        // dry gain node
        {
          id: 3 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 0.5),
            points: []
          }
        } satisfies GainNode,
        // wet gain node
        {
          id: 4 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 1.0),
            points: []
          }
        } satisfies GainNode
      ])

      assert.deepStrictEqual(graph.edges, [
        // reverb to wet
        { from: 2 as NodeId, to: 4 as NodeId },
        // dry to output
        { from: 3 as NodeId, to: 1 as NodeId },
        // wet to output
        { from: 4 as NodeId, to: 1 as NodeId }
      ])
    })
  })
})
