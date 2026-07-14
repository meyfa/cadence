import type { Asset, AssetId, Bus, BusId, Curve, Effect, Instrument, InstrumentId, InstrumentRouting, MixerRouting, NoteData, ParameterId, Program, Track } from '@meyfa/cadence-core'
import { beatsToSeconds, createSerialPattern, dbToGain } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { gainTransform, transformCurve } from '../src/automation.ts'
import { createEntityKey } from '../src/entities.ts'
import type { NodeId } from '../src/graph.ts'
import { createAudioGraph } from '../src/lowering.ts'
import type { BiquadNode, DelayNode, GainNode, IdentityNode, InstrumentNode, Node, OscillatorNode, PanNode, ReverbNode, SourceNode, WaveShaperNode, WidthNode } from '../src/nodes.ts'

const scalar = (value: number) => value as Numeric<undefined>
const beats = (value: number) => value as Numeric<'beats'>
const seconds = (value: number) => value as Numeric<'s'>
const db = (value: number) => value as Numeric<'db'>
const hz = (value: number) => value as Numeric<'hz'>
const bpm = (value: number) => value as Numeric<'bpm'>

const SIMPLE_CURVE: Curve<'s', 'db'> = {
  initial: db(-Infinity),
  points: [
    { time: seconds(0), value: db(-60), shape: 'step' },
    { time: seconds(0.5), value: db(0), shape: 'linear' },
    { time: seconds(1), value: db(-6), shape: 'step' }
  ]
}

function toGainCurve (curve: Curve<'s', 'db'>): Curve<'s', undefined> {
  return transformCurve(curve, gainTransform)
}

function compareIds (a: readonly [NodeId, Node], b: readonly [NodeId, Node]): number {
  return a[0] - b[0]
}

function createProgramWithInstrument (instrument: Instrument, asset?: Asset): Program {
  const assets = new Map<AssetId, Asset>()
  if (asset != null) {
    assets.set(asset.id, asset)
  }

  return {
    beatsPerBar: 4,
    instruments: new Map([[instrument.id, instrument]]),
    automations: new Map(),
    assets,
    track: {
      tempo: bpm(120),
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
    assets: new Map(),
    track: {
      tempo: bpm(120),
      parts: []
    },
    mixer: {
      buses: [
        {
          id: 100 as BusId,
          name: 'Bus 1',
          gain: {
            id: 400 as ParameterId,
            unit: 'db',
            initial: db(0)
          },
          pan: {
            id: 500 as ParameterId,
            unit: undefined,
            initial: scalar(0)
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
      assets: new Map(),
      track: {
        tempo: bpm(120),
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

  it('should include assets in the graph', () => {
    const assetId = 100 as AssetId

    const program: Program = {
      beatsPerBar: 4,
      instruments: new Map(),
      automations: new Map(),
      assets: new Map([
        [
          assetId,
          {
            id: assetId,
            url: 'foo.wav'
          }
        ]
      ]),
      track: {
        tempo: bpm(120),
        parts: []
      },
      mixer: {
        buses: [],
        routings: []
      }
    }

    const graph = createAudioGraph(program)

    assert.deepStrictEqual([...graph.assets.entries()], [
      [
        assetId,
        {
          id: assetId,
          url: 'foo.wav'
        }
      ]
    ])
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
              unit: 'db',
              initial: db(-6)
            },
            voices: [
              {
                invoke: () => ({
                  envelope: SIMPLE_CURVE,
                  source: {
                    type: 'oscillator',
                    shape: 'sine',
                    frequency: hz(440)
                  },
                  duration: seconds(1)
                })
              }
            ]
          } satisfies Instrument
        ]
      ]),

      automations: new Map(),
      assets: new Map(),

      track: {
        tempo: bpm(120),
        parts: []
      } satisfies Track,

      mixer: {
        buses: [
          {
            id: busId,
            name: 'Bus 1',
            gain: {
              id: busGainId,
              unit: 'db',
              initial: db(-3)
            },
            pan: {
              id: 500 as ParameterId,
              unit: undefined,
              initial: scalar(0)
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

    assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
      [
        1,
        {
          type: 'identity'
        } satisfies IdentityNode
      ],
      [
        2,
        {
          type: 'gain',
          gain: {
            initial: dbToGain(db(-3)),
            points: []
          }
        } satisfies GainNode
      ],
      [
        3,
        {
          type: 'instrument',
          trigger: (graph.nodes.get(3 as NodeId) as InstrumentNode).trigger
        } satisfies InstrumentNode
      ],
      [
        4,
        {
          type: 'gain',
          gain: {
            initial: dbToGain(db(-6)),
            points: []
          }
        } satisfies GainNode
      ]
    ])

    assert.deepStrictEqual(graph.edges, [
      { from: 3 as NodeId, to: 4 as NodeId },
      { from: 4 as NodeId, to: 2 as NodeId },
      { from: 2 as NodeId, to: 1 as NodeId }
    ])

    assert.deepStrictEqual(graph.outputIds, [1 as NodeId])
    assert.deepStrictEqual(graph.noteEvents.size, 0)

    const instrumentNode = graph.nodes.get(3 as NodeId) as InstrumentNode
    const voices = instrumentNode.trigger({
      pitch: 'A4',
      velocity: scalar(1),
      gate: beats(1)
    })

    assert.strictEqual(voices.length, 1)
    const [voice] = voices

    assert.deepStrictEqual(voice, {
      type: 'oscillator',
      shape: 'sine',
      frequency: hz(440),
      duration: seconds(1), // 0.5s for the note + 0.5s for the release
      gainCurve: (voice as OscillatorNode).gainCurve
    } satisfies SourceNode)
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
              unit: 'db',
              initial: db(-6)
            },
            voices: []
          } satisfies Instrument
        ]
      ]),

      automations: new Map([
        [
          instrumentGainId,
          {
            unit: 'db',
            initial: db(-6),
            points: [
              {
                time: seconds(0.5),
                value: db(-3),
                shape: 'linear'
              },
              {
                time: seconds(1),
                value: db(-12),
                shape: 'step'
              }
            ]
          }
        ]
      ]),

      assets: new Map(),

      track: {
        tempo: bpm(120),
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
      type: 'gain',
      gain: {
        initial: dbToGain(db(-6)),
        points: [
          {
            time: seconds(0.5),
            value: dbToGain(db(-3)),
            shape: 'exponential'
          },
          {
            time: seconds(1),
            value: dbToGain(db(-12)),
            shape: 'step'
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
              unit: 'db',
              initial: db(-6)
            },
            voices: []
          } satisfies Instrument
        ]
      ]),

      automations: new Map(),
      assets: new Map(),

      track: {
        tempo: bpm(120),
        parts: [
          {
            name: 'Part 1',
            length: beats(4),
            routings: [
              {
                source: {
                  type: 'pattern',
                  value: createSerialPattern([
                    { value: 'C4' },
                    { value: 'E4', velocity: scalar(0.75) }
                  ])
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
            length: beats(4),
            routings: [
              {
                source: {
                  type: 'pattern',
                  value: createSerialPattern([
                    { value: 'G4' },
                    { value: 'B4' }
                  ])
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
          { time: beats(0), pitch: 'C4', velocity: scalar(1), gate: beats(1) },
          { time: beats(1), pitch: 'E4', velocity: scalar(0.75), gate: beats(1) },
          { time: beats(4), pitch: 'G4', velocity: scalar(1), gate: beats(1) },
          { time: beats(5), pitch: 'B4', velocity: scalar(1), gate: beats(1) }
        ]
      ]
    ])
  })

  it('should allow negative infinity instrument gain', () => {
    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        unit: 'db',
        initial: db(-Infinity)
      },
      voices: []
    })

    assert.doesNotThrow(() => createAudioGraph(program))
  })

  it('should throw for invalid instrument gain', () => {
    for (const gain of [Infinity, Number.NaN]) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          unit: 'db',
          initial: db(gain)
        },
        voices: []
      })

      assert.throws(() => createAudioGraph(program), /Invalid gain/, `should throw for gain: ${gain}`)
    }
  })

  it('should lower dB curves into gain space', () => {
    const testCases: Array<Curve<'s', 'db'>> = [
      {
        initial: db(-Infinity),
        points: [
          { time: seconds(0), value: db(0), shape: 'step' }
        ]
      },
      {
        initial: db(-12),
        points: [
          { time: seconds(0.25), value: db(-6), shape: 'linear' },
          { time: seconds(0.5), value: db(-18), shape: 'step' }
        ]
      },
      SIMPLE_CURVE
    ]

    const note: NoteData = {
      pitch: 'C4',
      velocity: scalar(1),
      gate: beats(16)
    }

    for (const curve of testCases) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          unit: 'db',
          initial: db(-6)
        },
        voices: [
          {
            invoke: () => ({
              envelope: curve,
              source: {
                type: 'oscillator',
                shape: 'sine',
                frequency: hz(440)
              }
            })
          }
        ]
      })

      const graph = createAudioGraph(program)

      const instrumentNode = graph.nodes.get(2 as NodeId) as InstrumentNode
      const voices = instrumentNode.trigger(note)

      assert.strictEqual(voices.length, 1)
      const [voice] = voices

      assert.deepStrictEqual(voice.gainCurve, toGainCurve(curve), `test case: ${JSON.stringify(curve)}`)
    }
  })

  it('should skip voices with negative or zero duration', () => {
    const makeVoice = (frequency: Numeric<'hz'>, duration: Numeric<'s'> | undefined) => ({
      invoke: () => ({
        envelope: SIMPLE_CURVE,
        source: {
          type: 'oscillator',
          shape: 'sine',
          frequency
        },
        duration
      } as const)
    })

    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        unit: 'db',
        initial: db(-6)
      },
      voices: [
        makeVoice(hz(100), seconds(-1)),
        makeVoice(hz(200), seconds(0)),
        makeVoice(hz(300), seconds(1)),
        makeVoice(hz(400), undefined)
      ]
    })

    const graph = createAudioGraph(program)

    const instrumentNode = graph.nodes.get(2 as NodeId) as InstrumentNode
    const voices = instrumentNode.trigger({
      pitch: 'C4',
      velocity: scalar(1),
      gate: beats(1)
    })

    assert.deepStrictEqual(
      voices.map((voice) => voice.type === 'oscillator' ? voice.frequency : undefined),
      [300, 400]
    )
  })

  it('should throw for invalid sample playback rate', () => {
    for (const playbackRate of [0, -1, Infinity, -Infinity, Number.NaN]) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          unit: 'db',
          initial: db(-6)
        },
        voices: [
          {
            invoke: () => ({
              envelope: SIMPLE_CURVE,
              source: {
                type: 'sample',
                assetId: 300 as AssetId,
                length: seconds(-1),
                playbackRate: scalar(playbackRate)
              }
            })
          }
        ]
      }, {
        id: 300 as AssetId,
        url: 'foo.wav'
      })

      const graph = createAudioGraph(program)
      const instrumentNode = graph.nodes.get(2 as NodeId) as InstrumentNode

      assert.throws(() => {
        instrumentNode.trigger({
          pitch: 'C4',
          velocity: scalar(1),
          gate: beats(1)
        })
      }, /Invalid playback rate/, `should throw for playback rate: ${playbackRate}`)
    }
  })

  it('should throw for invalid oscillator frequency', () => {
    for (const frequency of [0, -1, Infinity, -Infinity, Number.NaN]) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          unit: 'db',
          initial: db(-6)
        },
        voices: [
          {
            invoke: () => ({
              envelope: SIMPLE_CURVE,
              source: {
                type: 'oscillator',
                shape: 'sine',
                frequency: hz(frequency)
              }
            })
          }
        ]
      })

      const graph = createAudioGraph(program)
      const instrumentNode = graph.nodes.get(2 as NodeId) as InstrumentNode

      assert.throws(() => {
        instrumentNode.trigger({
          pitch: 'C4',
          velocity: scalar(1),
          gate: beats(1)
        })
      }, /Invalid frequency/, `should throw for frequency: ${frequency}`)
    }
  })

  describe('effects', () => {
    describe('gain effect', () => {
      it('should handle gain', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'gain',
          gain: {
            id: 400 as ParameterId,
            unit: 'db',
            initial: db(-3)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'gain',
          gain: {
            initial: dbToGain(db(-3)),
            points: []
          }
        } satisfies GainNode)
      })

      it('should allow negative infinity gain', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'gain',
          gain: {
            id: 400 as ParameterId,
            unit: 'db',
            initial: db(-Infinity)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'gain',
          gain: {
            initial: scalar(0),
            points: []
          }
        } satisfies GainNode)
      })

      it('should throw for invalid gain', () => {
        for (const gain of [Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'gain',
            gain: {
              id: 400 as ParameterId,
              unit: 'db',
              initial: db(gain)
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
            unit: undefined,
            initial: scalar(0.5)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'pan',
          pan: {
            initial: scalar(0.5),
            points: []
          }
        } satisfies PanNode)
      })

      it('should clamp pan to [-1, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            unit: undefined,
            initial: scalar(Infinity)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'pan',
          pan: {
            initial: scalar(1),
            points: []
          }
        } satisfies PanNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            unit: undefined,
            initial: scalar(-Infinity)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'pan',
          pan: {
            initial: scalar(-1),
            points: []
          }
        } satisfies PanNode)
      })

      it('should throw for NaN pan', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            unit: undefined,
            initial: scalar(Number.NaN)
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
            unit: 'hz',
            initial: hz(1000)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'lowpass',
          frequency: {
            initial: hz(1000),
            points: []
          },
          rolloffPerOctave: db(12)
        } satisfies BiquadNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'lowpass',
          frequency: {
            id: 600 as ParameterId,
            unit: 'hz',
            initial: hz(-100)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'lowpass',
          frequency: {
            initial: hz(0),
            points: []
          },
          rolloffPerOctave: db(12)
        } satisfies BiquadNode)
      })

      it('should throw for invalid lowpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'lowpass',
            frequency: {
              id: 600 as ParameterId,
              unit: 'hz',
              initial: hz(frequency)
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
            unit: 'hz',
            initial: hz(500)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'highpass',
          frequency: {
            initial: hz(500),
            points: []
          },
          rolloffPerOctave: db(12)
        } satisfies BiquadNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'highpass',
          frequency: {
            id: 600 as ParameterId,
            unit: 'hz',
            initial: hz(-100)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'highpass',
          frequency: {
            initial: hz(0),
            points: []
          },
          rolloffPerOctave: db(12)
        } satisfies BiquadNode)
      })

      it('should throw for invalid highpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'highpass',
            frequency: {
              id: 600 as ParameterId,
              unit: 'hz',
              initial: hz(frequency)
            }
          })), /Invalid frequency/, `should throw for frequency: ${frequency}`)
        }
      })
    })

    describe('width effect', () => {
      it('should handle width', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: scalar(0.75)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'width',
          width: scalar(0.75)
        } satisfies WidthNode)
      })

      it('should clamp width to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: scalar(Infinity)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'width',
          width: scalar(1)
        } satisfies WidthNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: scalar(-Infinity)
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'width',
          width: scalar(0)
        } satisfies WidthNode)
      })

      it('should throw for NaN width', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: scalar(Number.NaN)
        })), /Invalid width/)
      })
    })

    describe('delay effect', () => {
      it('should handle delay', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: scalar(0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(0.4)
          },
          wet: db(0)
        }))

        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // delay node
          [
            2,
            {
              type: 'delay',
              time: beatsToSeconds(beats(0.5), bpm(120))
            } satisfies DelayNode
          ],
          // feedback gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.4),
                points: []
              }
            } satisfies GainNode
          ],
          // dry gain node
          [
            4,
            {
              type: 'gain',
              gain: {
                initial: scalar(1.0),
                points: []
              }
            } satisfies GainNode
          ],
          // wet gain node
          [
            5,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.5),
                points: []
              }
            } satisfies GainNode
          ]
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
          mix: scalar(Infinity),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(0.4)
          },
          wet: db(0)
        }))

        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // delay node
          [
            2,
            {
              type: 'delay',
              time: beatsToSeconds(beats(0.5), bpm(120))
            } satisfies DelayNode
          ],
          // feedback gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.4),
                points: []
              }
            } satisfies GainNode
          ]
        ])
      })

      it('should throw for NaN delay mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: scalar(Number.NaN),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(0.4)
          },
          wet: db(0)
        })), /Invalid mix/)
      })

      it('should throw for invalid delay time', () => {
        for (const time of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'delay',
            mix: scalar(0.25),
            time: runtimeNumeric('beats', time),
            feedback: {
              id: 400 as ParameterId,
              unit: undefined,
              initial: scalar(0.4)
            },
            wet: db(0)
          })), /Invalid time/, `should throw for time: ${time}`)
        }
      })

      it('should clamp delay feedback to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: scalar(0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(Infinity)
          },
          wet: db(0)
        }))

        assert.deepStrictEqual(graph.nodes.get(3 as NodeId), {
          type: 'gain',
          gain: {
            initial: scalar(1),
            points: []
          }
        } satisfies GainNode)
      })

      it('should throw for NaN delay feedback', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: scalar(0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(Number.NaN)
          },
          wet: db(0)
        })), /Invalid feedback/)
      })

      it('should handle delay specified in seconds', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: scalar(0.25),
          time: runtimeNumeric('s', 1.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(0.4)
          },
          wet: db(0)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'delay',
          time: seconds(1.5)
        } satisfies DelayNode)
      })

      it('should add a gain node for non-zero wet level', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: scalar(0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            unit: undefined,
            initial: scalar(0.4)
          },
          wet: db(-6)
        }))

        // Note: There already is a wet gain node to handle the mix level,
        // but it cannot be reused as there may be separate automations for the mix and wet parameters,
        // which would unnecessarily complicate the calculations.
        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // delay node
          [
            2,
            {
              type: 'delay',
              time: beatsToSeconds(beats(0.5), bpm(120))
            } satisfies DelayNode
          ],
          // feedback gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.4),
                points: []
              }
            } satisfies GainNode
          ],
          // wet gain node for wet level
          [
            4,
            {
              type: 'gain',
              gain: {
                initial: dbToGain(db(-6)),
                points: []
              }
            } satisfies GainNode
          ],
          // dry gain node (mix)
          [
            5,
            {
              type: 'gain',
              gain: {
                initial: scalar(1.0),
                points: []
              }
            } satisfies GainNode
          ],
          // wet gain node (mix)
          [
            6,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.5),
                points: []
              }
            } satisfies GainNode
          ]
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
            mix: scalar(0.25),
            time: runtimeNumeric('beats', 0.5),
            feedback: {
              id: 400 as ParameterId,
              unit: undefined,
              initial: scalar(0.4)
            },
            wet: db(wet)
          })), /Invalid gain/, `should throw for wet level: ${wet}`)
        }
      })
    })

    describe('reverb effect', () => {
      it('should handle reverb', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: scalar(0.75),
          decay: runtimeNumeric('s', 2),
          wet: db(0)
        }))

        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // reverb node
          [
            2,
            {
              type: 'reverb',
              decay: seconds(2)
            } satisfies ReverbNode
          ],
          // dry gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.5),
                points: []
              }
            } satisfies GainNode
          ],
          // wet gain node
          [
            4,
            {
              type: 'gain',
              gain: {
                initial: scalar(1.0),
                points: []
              }
            } satisfies GainNode
          ]
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
          mix: scalar(1.5),
          decay: runtimeNumeric('s', 2),
          wet: db(0)
        }))

        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // reverb node
          [
            2,
            {
              type: 'reverb',
              decay: seconds(2)
            } satisfies ReverbNode
          ]
        ])
      })

      it('should throw for NaN reverb mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: scalar(Number.NaN),
          decay: runtimeNumeric('s', 2),
          wet: db(0)
        })), /Invalid mix/)
      })

      it('should throw for invalid reverb decay', () => {
        for (const decay of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'reverb',
            mix: scalar(0.75),
            decay: runtimeNumeric('s', decay),
            wet: db(0)
          })), /Invalid decay/, `should throw for decay: ${decay}`)
        }
      })

      it('should handle reverb specified in beats', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: scalar(0.75),
          decay: runtimeNumeric('beats', 2),
          wet: db(0)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'reverb',
          decay: beatsToSeconds(beats(2), bpm(120))
        } satisfies ReverbNode)
      })

      it('should add a gain node for non-zero wet level', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: scalar(0.25),
          decay: runtimeNumeric('s', 2),
          wet: db(-6)
        }))

        // Note: There already is a wet gain node to handle the mix level,
        // but it cannot be reused as there may be separate automations for the mix and wet parameters,
        // which would unnecessarily complicate the calculations.
        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // reverb node
          [
            2,
            {
              type: 'reverb',
              decay: seconds(2)
            } satisfies ReverbNode
          ],
          // wet gain node for wet level
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: dbToGain(db(-6)),
                points: []
              }
            } satisfies GainNode
          ],
          // dry gain node (mix)
          [
            4,
            {
              type: 'gain',
              gain: {
                initial: scalar(1.0),
                points: []
              }
            } satisfies GainNode
          ],
          // wet gain node (mix)
          [
            5,
            {
              type: 'gain',
              gain: {
                initial: scalar(0.5),
                points: []
              }
            } satisfies GainNode
          ]
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
            mix: scalar(0.75),
            decay: runtimeNumeric('s', 2),
            wet: db(wet)
          })), /Invalid gain/, `should throw for wet level: ${wet}`)
        }
      })
    })

    describe('clip effect', () => {
      it('should create gain, wave shaper, and makeup nodes', () => {
        const threshold = db(-6)

        const graph = createAudioGraph(createProgramWithEffect({
          type: 'clip',
          threshold: {
            id: 400 as ParameterId,
            unit: 'db',
            initial: threshold
          }
        }))

        assert.deepStrictEqual([...graph.nodes].sort(compareIds), [
          // output node
          [
            1,
            {
              type: 'identity'
            } satisfies IdentityNode
          ],
          // pre-gain to set the threshold
          [
            2,
            {
              type: 'gain',
              gain: {
                initial: scalar(1 / dbToGain(threshold)),
                points: []
              }
            } satisfies GainNode
          ],
          // wave shaper
          [
            3,
            {
              type: 'wave_shaper',
              curve: new Float32Array([-1, 0, 1])
            } satisfies WaveShaperNode
          ],
          // makeup gain
          [
            4,
            {
              type: 'gain',
              gain: {
                initial: dbToGain(threshold),
                points: []
              }
            } satisfies GainNode
          ]
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
              unit: 'db',
              initial: db(threshold)
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
          unit: 'db',
          initial: db(-6)
        },
        voices: []
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
                unit: 'db',
                initial: db(-6)
              },
              voices: []
            } satisfies Instrument
          ]
        ]),
        automations: new Map(),
        assets: new Map(),
        track: {
          tempo: bpm(120),
          parts: []
        },
        mixer: {
          buses: [
            {
              id: busId,
              name: 'Bus 1',
              gain: {
                id: 201 as ParameterId,
                unit: 'db',
                initial: db(-3)
              },
              pan: {
                id: 202 as ParameterId,
                unit: undefined,
                initial: scalar(0)
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

      const interval = seconds(0.123)

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
        unit: 'db',
        initial: db(-6)
      },
      voices: []
    })

    for (const interval of [Infinity, -Infinity, Number.NaN, 0, -1]) {
      const options = {
        metering: {
          interval: seconds(interval)
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
