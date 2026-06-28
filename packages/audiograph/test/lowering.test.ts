import type { Bus, BusId, Effect, Envelope, Instrument, InstrumentId, InstrumentRouting, MidiNote, MixerRouting, ParameterId, Pitch, Program, Track } from '@core'
import { beatsToSeconds, createSerialPattern } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain } from '../src/constants.js'
import { createEntityKey } from '../src/entities.js'
import type { NodeId } from '../src/graph.js'
import { createAudioGraph } from '../src/lowering.js'
import type { DelayNode, GainNode, IdentityNode, Node, ReverbNode, SampleNode, WaveShaperNode } from '../src/nodes.js'

const defaultEnvelope: Envelope = {
  attack: numeric('s', 0.01),
  decay: numeric('s', 0.1),
  sustain: numeric(undefined, 0.8),
  release: numeric('s', 0.5)
}

function compareIds (a: Node, b: Node): number {
  return a.id - b.id
}

function createProgramWithInstrument (instrument: Instrument): Program {
  return {
    beatsPerBar: 4,
    instruments: new Map([[instrument.id, instrument]]),
    automations: new Map(),
    track: {
      tempo: numeric('bpm', 120),
      parts: []
    },
    mixer: {
      buses: [],
      routings: [
        {
          implicit: true,
          source: {
            type: 'instrument',
            id: instrument.id
          },
          destination: {
            type: 'output'
          }
        }
      ]
    }
  }
}

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
          gain: {
            id: 400 as ParameterId,
            initial: numeric('db', 0)
          },
          pan: {
            id: 500 as ParameterId,
            initial: numeric(undefined, 0)
          },
          effects: [effect]
        }
      ],
      routings: [
        {
          implicit: false,
          source: {
            type: 'bus',
            id: 100 as BusId
          },
          destination: {
            type: 'output'
          }
        }
      ]
    }
  }
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
    const busGainId = 400 as ParameterId

    const program: Program = {
      beatsPerBar: 4,

      instruments: new Map([
        [
          instrumentId,
          {
            id: instrumentId,
            gain: {
              id: instrumentGainId,
              initial: numeric('db', -6)
            },
            source: {
              type: 'sample',
              url: 'foo.wav'
            },
            envelope: defaultEnvelope
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
            gain: {
              id: busGainId,
              initial: numeric('db', -3)
            },
            pan: {
              id: 500 as ParameterId,
              initial: numeric(undefined, 0)
            },
            effects: []
          } satisfies Bus
        ],

        routings: [
          {
            implicit: false,
            source: {
              type: 'instrument',
              id: instrumentId
            },
            destination: {
              type: 'bus',
              id: busId
            }
          } satisfies MixerRouting,

          {
            implicit: true,
            source: {
              type: 'bus',
              id: busId
            },
            destination: {
              type: 'output'
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
        type: 'gain',
        gain: {
          initial: numeric(undefined, dbToGain(-3)),
          points: []
        }
      } satisfies GainNode,
      {
        id: 3 as NodeId,
        type: 'sample',
        envelope: defaultEnvelope,
        length: undefined,
        url: 'foo.wav',
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
            gain: {
              id: instrumentGainId,
              initial: numeric('db', -6)
            },
            source: {
              type: 'sample',
              url: 'foo.wav'
            },
            envelope: defaultEnvelope
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
              type: 'instrument',
              id: instrumentId
            },
            destination: {
              type: 'output'
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
            gain: {
              id: 200 as ParameterId,
              initial: numeric('db', -6)
            },
            source: {
              type: 'sample',
              url: 'foo.wav'
            },
            envelope: defaultEnvelope
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
                  type: 'pattern',
                  value: createSerialPattern([
                    { value: 'C4' },
                    { value: 'E4', velocity: numeric(undefined, 0.75) }
                  ], 1)
                },
                destination: {
                  type: 'instrument',
                  id: instrumentId
                }
              } satisfies InstrumentRouting
            ]
          },
          {
            name: 'Part 2',
            length: numeric('beats', 4),
            routings: [
              {
                source: {
                  type: 'pattern',
                  value: createSerialPattern([
                    { value: 'G4' },
                    { value: 'B4' }
                  ], 1)
                },
                destination: {
                  type: 'instrument',
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
          { time: 0.5, pitch: 64, velocity: 0.75, duration: 0.5 },
          { time: 2, pitch: 67, velocity: 1.0, duration: 0.5 },
          { time: 2.5, pitch: 71, velocity: 1.0, duration: 0.5 }
        ]
      ]
    ])
  })

  it('should allow negative infinity instrument gain', () => {
    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        initial: numeric('db', -Infinity)
      },
      source: {
        type: 'sample',
        url: 'foo.wav'
      },
      envelope: defaultEnvelope
    })

    assert.doesNotThrow(() => createAudioGraph(program))
  })

  it('should throw for invalid instrument gain', () => {
    for (const gain of [Infinity, Number.NaN]) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          initial: numeric('db', gain)
        },
        source: {
          type: 'sample',
          url: 'foo.wav'
        },
        envelope: defaultEnvelope
      })

      assert.throws(() => createAudioGraph(program), /Invalid gain/, `should throw for gain: ${gain}`)
    }
  })

  it('should throw for invalid instrument root note', () => {
    for (const rootNote of ['C-1' as Pitch, 'G10' as Pitch]) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        rootNote,
        gain: {
          id: 200 as ParameterId,
          initial: numeric('db', -6)
        },
        source: {
          type: 'sample',
          url: 'foo.wav'
        },
        envelope: defaultEnvelope
      })

      assert.throws(() => createAudioGraph(program), /Invalid pitch/, `should throw for root note: ${rootNote}`)
    }
  })

  it('should clamp negative sample lengths to zero', () => {
    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        initial: numeric('db', -6)
      },
      source: {
        type: 'sample',
        url: 'foo.wav',
        length: numeric('s', -1)
      },
      envelope: defaultEnvelope
    })

    const graph = createAudioGraph(program)
    assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
      id: 2 as NodeId,
      type: 'sample',
      envelope: defaultEnvelope,
      url: 'foo.wav',
      rootNote: 72 as MidiNote,
      length: numeric('s', 0)
    } satisfies SampleNode)
  })

  it('should treat infinite sample length as valid', () => {
    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        initial: numeric('db', -6)
      },
      source: {
        type: 'sample',
        url: 'foo.wav',
        length: numeric('s', Infinity)
      },
      envelope: defaultEnvelope
    })

    const graph = createAudioGraph(program)
    assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
      id: 2 as NodeId,
      type: 'sample',
      envelope: defaultEnvelope,
      url: 'foo.wav',
      rootNote: 72 as MidiNote,
      length: undefined
    } satisfies SampleNode)
  })

  it('should throw for NaN sample length', () => {
    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        initial: numeric('db', -6)
      },
      source: {
        type: 'sample',
        url: 'foo.wav',
        length: numeric('s', Number.NaN)
      },
      envelope: defaultEnvelope
    })

    assert.throws(() => createAudioGraph(program), /Invalid length/)
  })

  it('should clamp envelope parameters to valid ranges', () => {
    const createEnvelope = (adsr: [number, number, number, number]): Envelope => ({
      attack: numeric('s', adsr[0]),
      decay: numeric('s', adsr[1]),
      sustain: numeric(undefined, adsr[2]),
      release: numeric('s', adsr[3])
    })

    const testCases: Array<{ envelope: Envelope, expected: Envelope }> = [
      {
        envelope: createEnvelope([-1, 0, 1, 0]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([0, -1, 1, 0]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([0, 0, -1, 0]),
        expected: createEnvelope([0, 0, 0, 0])
      },
      {
        envelope: createEnvelope([0, 0, 2, 0]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([0, 0, 1, -1]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([Infinity, 0, 1, 0]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([0, Infinity, 1, 0]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([0, 0, Number.NaN, 0]),
        expected: createEnvelope([0, 0, 0, 0])
      },
      {
        envelope: createEnvelope([0, 0, Infinity, 0]),
        expected: createEnvelope([0, 0, 1, 0])
      },
      {
        envelope: createEnvelope([0, 0, 1, Infinity]),
        expected: createEnvelope([0, 0, 1, 0])
      }
    ]

    for (const { envelope, expected } of testCases) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          initial: numeric('db', -6)
        },
        source: {
          type: 'sample',
          url: 'foo.wav'
        },
        envelope
      })

      const graph = createAudioGraph(program)

      assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
        id: 2 as NodeId,
        type: 'sample',
        url: 'foo.wav',
        rootNote: 72 as MidiNote,
        length: undefined,
        envelope: expected
      } satisfies SampleNode, `test case: ${JSON.stringify(envelope)}`)
    }
  })

  describe('effects', () => {
    describe('gain effect', () => {
      it('should handle gain', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'gain',
          gain: {
            id: 400 as ParameterId,
            initial: numeric('db', -3)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, dbToGain(-3)),
            points: []
          }
        })
      })

      it('should allow negative infinity gain', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'gain',
          gain: {
            id: 400 as ParameterId,
            initial: numeric('db', -Infinity)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 0),
            points: []
          }
        })
      })

      it('should throw for invalid gain', () => {
        for (const gain of [Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'gain',
            gain: {
              id: 400 as ParameterId,
              initial: numeric('db', gain)
            }
          })), /Invalid gain/, `should throw for gain: ${gain}`)
        }
      })
    })

    describe('pan effect', () => {
      it('should handle pan', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: numeric(undefined, 0.5)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'pan',
          pan: {
            initial: numeric(undefined, 0.5),
            points: []
          }
        })
      })

      it('should clamp pan to [-1, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: numeric(undefined, Infinity)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'pan',
          pan: {
            initial: numeric(undefined, 1),
            points: []
          }
        })

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: numeric(undefined, -Infinity)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'pan',
          pan: {
            initial: numeric(undefined, -1),
            points: []
          }
        })
      })

      it('should throw for NaN pan', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: numeric(undefined, Number.NaN)
          }
        })), /Invalid pan/)
      })
    })

    describe('lowpass effect', () => {
      it('should handle lowpass', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'lowpass',
          frequency: {
            id: 600 as ParameterId,
            initial: numeric('hz', 1000)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'lowpass',
          frequency: {
            initial: numeric('hz', 1000),
            points: []
          },
          rolloffPerOctave: numeric('db', 12)
        })

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'lowpass',
          frequency: {
            id: 600 as ParameterId,
            initial: numeric('hz', -100)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'lowpass',
          frequency: {
            initial: numeric('hz', 0),
            points: []
          },
          rolloffPerOctave: numeric('db', 12)
        })
      })

      it('should throw for invalid lowpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'lowpass',
            frequency: {
              id: 600 as ParameterId,
              initial: numeric('hz', frequency)
            }
          })), /Invalid frequency/, `should throw for frequency: ${frequency}`)
        }
      })
    })

    describe('highpass effect', () => {
      it('should handle highpass', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'highpass',
          frequency: {
            id: 600 as ParameterId,
            initial: numeric('hz', 500)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'highpass',
          frequency: {
            initial: numeric('hz', 500),
            points: []
          },
          rolloffPerOctave: numeric('db', 12)
        })

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'highpass',
          frequency: {
            id: 600 as ParameterId,
            initial: numeric('hz', -100)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'highpass',
          frequency: {
            initial: numeric('hz', 0),
            points: []
          },
          rolloffPerOctave: numeric('db', 12)
        })
      })

      it('should throw for invalid highpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'highpass',
            frequency: {
              id: 600 as ParameterId,
              initial: numeric('hz', frequency)
            }
          })), /Invalid frequency/, `should throw for frequency: ${frequency}`)
        }
      })
    })

    describe('width effect', () => {
      it('should handle width', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: numeric(undefined, 0.75)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'width',
          width: numeric(undefined, 0.75)
        })
      })

      it('should clamp width to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: numeric(undefined, Infinity)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'width',
          width: numeric(undefined, 1)
        })

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: numeric(undefined, -Infinity)
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'width',
          width: numeric(undefined, 0)
        })
      })

      it('should throw for NaN width', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: numeric(undefined, Number.NaN)
        })), /Invalid width/)
      })
    })

    describe('delay effect', () => {
      it('should handle delay', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, 0.4)
          },
          wet: numeric('db', 0)
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
          // input to output (dry)
          { from: 4 as NodeId, to: 1 as NodeId },
          // wet to output
          { from: 5 as NodeId, to: 1 as NodeId }
        ])
      })

      it('should clamp delay mix to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, Infinity),
          time: numeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, 0.4)
          },
          wet: numeric('db', 0)
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
          } satisfies GainNode
        ])
      })

      it('should throw for NaN delay mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, Number.NaN),
          time: numeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, 0.4)
          },
          wet: numeric('db', 0)
        })), /Invalid mix/)
      })

      it('should throw for invalid delay time', () => {
        for (const time of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'delay',
            mix: numeric(undefined, 0.25),
            time: numeric('beats', time),
            feedback: {
              id: 400 as ParameterId,
              initial: numeric(undefined, 0.4)
            },
            wet: numeric('db', 0)
          })), /Invalid time/, `should throw for time: ${time}`)
        }
      })

      it('should clamp delay feedback to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, Infinity)
          },
          wet: numeric('db', 0)
        }))

        assert.deepStrictEqual(graph.nodes.get(3 as NodeId), {
          id: 3 as NodeId,
          type: 'gain',
          gain: {
            initial: numeric(undefined, 1),
            points: []
          }
        } satisfies GainNode)
      })

      it('should throw for NaN delay feedback', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, Number.NaN)
          },
          wet: numeric('db', 0)
        })), /Invalid feedback/)
      })

      it('should handle delay specified in seconds', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('s', 1.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, 0.4)
          },
          wet: numeric('db', 0)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'delay',
          time: numeric('s', 1.5)
        } satisfies DelayNode)
      })

      it('should add a gain node for non-zero wet level', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: numeric(undefined, 0.4)
          },
          wet: numeric('db', -6)
        }))

        // Note: There already is a wet gain node to handle the mix level,
        // but it cannot be reused as there may be separate automations for the mix and wet parameters,
        // which would unnecessarily complicate the calculations.
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
          // wet gain node for wet level
          {
            id: 4 as NodeId,
            type: 'gain',
            gain: {
              initial: numeric(undefined, dbToGain(-6)),
              points: []
            }
          } satisfies GainNode,
          // dry gain node (mix)
          {
            id: 5 as NodeId,
            type: 'gain',
            gain: {
              initial: numeric(undefined, 1.0),
              points: []
            }
          } satisfies GainNode,
          // wet gain node (mix)
          {
            id: 6 as NodeId,
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
          // delay to wet level
          { from: 2 as NodeId, to: 4 as NodeId },
          // wet level to wet mix
          { from: 4 as NodeId, to: 6 as NodeId },
          // input to output (dry)
          { from: 5 as NodeId, to: 1 as NodeId },
          // wet mix to output
          { from: 6 as NodeId, to: 1 as NodeId }
        ])
      })

      it('should throw for invalid wet level', () => {
        for (const wet of [Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'delay',
            mix: numeric(undefined, 0.25),
            time: numeric('beats', 0.5),
            feedback: {
              id: 400 as ParameterId,
              initial: numeric(undefined, 0.4)
            },
            wet: numeric('db', wet)
          })), /Invalid gain/, `should throw for wet level: ${wet}`)
        }
      })
    })

    describe('reverb effect', () => {
      it('should handle reverb', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, 0.75),
          decay: numeric('s', 2),
          wet: numeric('db', 0)
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

      it('should clamp reverb mix to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, 1.5),
          decay: numeric('s', 2),
          wet: numeric('db', 0)
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
          } satisfies ReverbNode
        ])
      })

      it('should throw for NaN reverb mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, Number.NaN),
          decay: numeric('s', 2),
          wet: numeric('db', 0)
        })), /Invalid mix/)
      })

      it('should throw for invalid reverb decay', () => {
        for (const decay of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'reverb',
            mix: numeric(undefined, 0.75),
            decay: numeric('s', decay),
            wet: numeric('db', 0)
          })), /Invalid decay/, `should throw for decay: ${decay}`)
        }
      })

      it('should handle reverb specified in beats', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, 0.75),
          decay: numeric('beats', 2),
          wet: numeric('db', 0)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'reverb',
          decay: beatsToSeconds(numeric('beats', 2), numeric('bpm', 120))
        } satisfies ReverbNode)
      })

      it('should add a gain node for non-zero wet level', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, 0.25),
          decay: numeric('s', 2),
          wet: numeric('db', -6)
        }))

        // Note: There already is a wet gain node to handle the mix level,
        // but it cannot be reused as there may be separate automations for the mix and wet parameters,
        // which would unnecessarily complicate the calculations.
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
          // wet gain node for wet level
          {
            id: 3 as NodeId,
            type: 'gain',
            gain: {
              initial: numeric(undefined, dbToGain(-6)),
              points: []
            }
          } satisfies GainNode,
          // dry gain node (mix)
          {
            id: 4 as NodeId,
            type: 'gain',
            gain: {
              initial: numeric(undefined, 1.0),
              points: []
            }
          } satisfies GainNode,
          // wet gain node (mix)
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
          // reverb to wet
          { from: 2 as NodeId, to: 3 as NodeId },
          // wet level to wet mix
          { from: 3 as NodeId, to: 5 as NodeId },
          // dry to output
          { from: 4 as NodeId, to: 1 as NodeId },
          // wet mix to output
          { from: 5 as NodeId, to: 1 as NodeId }
        ])
      })

      it('should throw for invalid wet level', () => {
        for (const wet of [Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'reverb',
            mix: numeric(undefined, 0.75),
            decay: numeric('s', 2),
            wet: numeric('db', wet)
          })), /Invalid gain/, `should throw for wet level: ${wet}`)
        }
      })
    })

    describe('clip effect', () => {
      it('should create gain, wave shaper, and makeup nodes', () => {
        const threshold = numeric('db', -6)

        const graph = createAudioGraph(createProgramWithEffect({
          type: 'clip',
          threshold: {
            id: 400 as ParameterId,
            initial: threshold
          }
        }))

        assert.deepStrictEqual([...graph.nodes.values()].sort(compareIds), [
          // output node
          {
            id: 1 as NodeId,
            type: 'identity'
          } satisfies IdentityNode,
          // pre-gain to set the threshold
          {
            id: 2 as NodeId,
            type: 'gain',
            gain: {
              initial: numeric(undefined, 1 / dbToGain(threshold.value)),
              points: []
            }
          } satisfies GainNode,
          // wave shaper
          {
            id: 3 as NodeId,
            type: 'wave_shaper',
            curve: new Float32Array([-1, 0, 1])
          } satisfies WaveShaperNode,
          // makeup gain
          {
            id: 4 as NodeId,
            type: 'gain',
            gain: {
              initial: numeric(undefined, dbToGain(threshold.value)),
              points: []
            }
          } satisfies GainNode
        ])

        assert.deepStrictEqual(graph.edges, [
          // pre-gain to wave shaper
          { from: 2 as NodeId, to: 3 as NodeId },
          // wave shaper to makeup gain
          { from: 3 as NodeId, to: 4 as NodeId },
          // makeup gain to output
          { from: 4 as NodeId, to: 1 as NodeId }
        ])
      })

      it('should throw for invalid clip threshold', () => {
        for (const threshold of [-Infinity, Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'clip',
            threshold: {
              id: 400 as ParameterId,
              initial: numeric('db', threshold)
            }
          })), /Invalid gain/, `should throw for threshold: ${threshold}`)
        }
      })
    })
  })

  describe('metering', () => {
    it('should not add metering by default', () => {
      const graph = createAudioGraph(createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          initial: numeric('db', -6)
        },
        source: {
          type: 'sample',
          url: 'foo.wav'
        },
        envelope: defaultEnvelope
      }))

      assert.strictEqual(graph.meters.size, 0)
    })

    it('should add meters when enabled', () => {
      const instrumentId = 100 as InstrumentId
      const busId = 200 as BusId

      const program: Program = {
        beatsPerBar: 4,
        instruments: new Map([
          [
            instrumentId,
            {
              id: instrumentId,
              gain: {
                id: 200 as ParameterId,
                initial: numeric('db', -6)
              },
              source: {
                type: 'sample',
                url: 'foo.wav'
              },
              envelope: defaultEnvelope
            } satisfies Instrument
          ]
        ]),
        automations: new Map(),
        track: {
          tempo: numeric('bpm', 120),
          parts: []
        },
        mixer: {
          buses: [
            {
              id: busId,
              name: 'Bus 1',
              gain: {
                id: 201 as ParameterId,
                initial: numeric('db', -3)
              },
              pan: {
                id: 202 as ParameterId,
                initial: numeric(undefined, 0)
              },
              effects: []
            } satisfies Bus
          ],
          routings: [
            {
              implicit: false,
              source: {
                type: 'instrument',
                id: instrumentId
              },
              destination: {
                type: 'bus',
                id: busId
              }
            } satisfies MixerRouting,
            {
              implicit: true,
              source: {
                type: 'bus',
                id: busId
              },
              destination: {
                type: 'output'
              }
            } satisfies MixerRouting
          ]
        }
      }

      const interval = numeric('s', 0.123)

      const graph = createAudioGraph(program, {
        metering: { interval }
      })

      const outputKey = createEntityKey({ type: 'output' })
      const outputMeters = graph.meters.get(outputKey)
      assert.ok(outputMeters)

      const outputGainMeter = graph.nodes.get(outputMeters.gainMeterId)
      assert.strictEqual(outputGainMeter?.type, 'gain_meter')
      assert.deepStrictEqual(outputGainMeter.key, outputKey)
      assert.deepStrictEqual(outputGainMeter.interval, interval)

      const busKey = createEntityKey({ type: 'bus', id: busId })
      const busMeters = graph.meters.get(busKey)
      assert.ok(busMeters)

      const busGainMeter = graph.nodes.get(busMeters.gainMeterId)
      assert.strictEqual(busGainMeter?.type, 'gain_meter')
      assert.deepStrictEqual(busGainMeter.key, busKey)
      assert.deepStrictEqual(busGainMeter.interval, interval)

      const instrumentKey = createEntityKey({ type: 'instrument', id: instrumentId })
      const instrumentMeters = graph.meters.get(instrumentKey)
      assert.ok(instrumentMeters)

      const instrumentGainMeter = graph.nodes.get(instrumentMeters.gainMeterId)
      assert.strictEqual(instrumentGainMeter?.type, 'gain_meter')
      assert.deepStrictEqual(instrumentGainMeter.key, instrumentKey)
      assert.deepStrictEqual(instrumentGainMeter.interval, interval)
    })
  })

  it('should throw for invalid metering interval', () => {
    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        initial: numeric('db', -6)
      },
      source: {
        type: 'sample',
        url: 'foo.wav'
      },
      envelope: defaultEnvelope
    })

    for (const interval of [Infinity, -Infinity, Number.NaN, 0, -1]) {
      const options = {
        metering: {
          interval: numeric('s', interval)
        }
      }

      assert.throws(
        () => createAudioGraph(program, options),
        /Invalid metering interval/,
        `should throw for interval: ${interval}`
      )
    }
  })
})
