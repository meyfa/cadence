import type { Bus, BusId, Effect, Instrument, InstrumentId, InstrumentRouting, MidiNote, MixerRouting, ParameterId, Pitch, Program, Track } from '@core'
import { beatsToSeconds, createSerialPattern } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain } from '../src/constants.js'
import { createEntityKey } from '../src/entities.js'
import type { NodeId } from '../src/graph.js'
import { createAudioGraph } from '../src/lowering.js'
import type { DelayNode, GainNode, IdentityNode, Node, ReverbNode, SampleNode } from '../src/nodes.js'

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
        length: undefined,
        type: 'sample',
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
                  type: 'pattern',
                  value: createSerialPattern([{ value: 'C4' }, { value: 'E4' }], 1)
                },
                destination: {
                  type: 'instrument',
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
                  type: 'pattern',
                  value: createSerialPattern([{ value: 'G4' }, { value: 'B4' }], 1)
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
          { time: 0.5, pitch: 64, velocity: 1.0, duration: 0.5 },
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
      }
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
        }
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
        }
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
      }
    })

    const graph = createAudioGraph(program)
    assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
      id: 2 as NodeId,
      type: 'sample',
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
      }
    })

    const graph = createAudioGraph(program)
    assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
      id: 2 as NodeId,
      type: 'sample',
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
      }
    })

    assert.throws(() => createAudioGraph(program), /Invalid length/)
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
          frequency: numeric('hz', 1000)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'lowpass',
          frequency: numeric('hz', 1000),
          rolloffPerOctave: numeric('db', 12)
        })

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'lowpass',
          frequency: numeric('hz', -100)
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'lowpass',
          frequency: numeric('hz', -100),
          rolloffPerOctave: numeric('db', 12)
        })
      })

      it('should throw for invalid lowpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'lowpass',
            frequency: numeric('hz', frequency)
          })), /Invalid frequency/, `should throw for frequency: ${frequency}`)
        }
      })
    })

    describe('highpass effect', () => {
      it('should handle highpass', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'highpass',
          frequency: numeric('hz', 500)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'highpass',
          frequency: numeric('hz', 500),
          rolloffPerOctave: numeric('db', 12)
        })

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'highpass',
          frequency: numeric('hz', -100)
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'biquad',
          filterType: 'highpass',
          frequency: numeric('hz', -100),
          rolloffPerOctave: numeric('db', 12)
        })
      })

      it('should throw for invalid highpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'highpass',
            frequency: numeric('hz', frequency)
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

      it('should clamp delay mix to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, Infinity),
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
          } satisfies GainNode
        ])
      })

      it('should throw for NaN delay mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, Number.NaN),
          time: numeric('beats', 0.5),
          feedback: numeric(undefined, 0.4)
        })), /Invalid mix/)
      })

      it('should throw for invalid delay time', () => {
        for (const time of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'delay',
            mix: numeric(undefined, 0.25),
            time: numeric('beats', time),
            feedback: numeric(undefined, 0.4)
          })), /Invalid time/, `should throw for time: ${time}`)
        }
      })

      it('should clamp delay feedback to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('beats', 0.5),
          feedback: numeric(undefined, Infinity)
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
          feedback: numeric(undefined, Number.NaN)
        })), /Invalid feedback/)
      })

      it('should handle delay specified in seconds', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: numeric(undefined, 0.25),
          time: numeric('s', 1.5),
          feedback: numeric(undefined, 0.4)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'delay',
          time: numeric('s', 1.5)
        } satisfies DelayNode)
      })
    })

    describe('reverb effect', () => {
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

      it('should clamp reverb mix to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, 1.5),
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
          } satisfies ReverbNode
        ])
      })

      it('should throw for NaN reverb mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, Number.NaN),
          decay: numeric('s', 2)
        })), /Invalid mix/)
      })

      it('should throw for invalid reverb decay', () => {
        for (const decay of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'reverb',
            mix: numeric(undefined, 0.75),
            decay: numeric('s', decay)
          })), /Invalid decay/, `should throw for decay: ${decay}`)
        }
      })

      it('should handle reverb specified in beats', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: numeric(undefined, 0.75),
          decay: numeric('beats', 2)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          id: 2 as NodeId,
          type: 'reverb',
          decay: beatsToSeconds(numeric('beats', 2), numeric('bpm', 120))
        } satisfies ReverbNode)
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
        }
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
              }
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
      }
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
