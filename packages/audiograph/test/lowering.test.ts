import type { Asset, AssetId, Bus, BusId, Curve, Effect, Instrument, InstrumentId, InstrumentRouting, MixerRouting, NoteData, ParameterId, Program, Track } from '@core'
import { beatsToSeconds, createSerialPattern, dbToGain } from '@core'
import type { Numeric } from '@utility'
import { runtimeNumeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { gainTransform, transformCurve } from '../src/automation.js'
import { createEntityKey } from '../src/entities.js'
import type { NodeId } from '../src/graph.js'
import { createAudioGraph } from '../src/lowering.js'
import type { BiquadNode, DelayNode, GainNode, IdentityNode, InstrumentNode, Node, OscillatorNode, PanNode, ReverbNode, SourceNode, WaveShaperNode, WidthNode } from '../src/nodes.js'

const SIMPLE_CURVE: Curve<'s', 'db'> = {
  initial: runtimeNumeric('db', -Infinity),
  points: [
    { time: runtimeNumeric('s', 0), value: runtimeNumeric('db', -60), shape: 'step' },
    { time: runtimeNumeric('s', 0.5), value: runtimeNumeric('db', 0), shape: 'linear' },
    { time: runtimeNumeric('s', 1), value: runtimeNumeric('db', -6), shape: 'step' }
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
      tempo: 120 as Numeric<'bpm'>,
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
      tempo: 120 as Numeric<'bpm'>,
      parts: []
    },
    mixer: {
      buses: [
        {
          id: 100 as BusId,
          name: 'Bus 1',
          gain: {
            id: 400 as ParameterId,
            initial: runtimeNumeric('db', 0)
          },
          pan: {
            id: 500 as ParameterId,
            initial: runtimeNumeric(undefined, 0)
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

const beats = (value: number) => value as Numeric<'beats'>
const scalar = (value: number) => value as Numeric<undefined>

describe('lowering.ts', () => {
  it('should lower empty program correctly', () => {
    const program: Program = {
      beatsPerBar: 4,
      instruments: new Map(),
      automations: new Map(),
      assets: new Map(),
      track: {
        tempo: 120 as Numeric<'bpm'>,
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
        tempo: 120 as Numeric<'bpm'>,
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
              initial: runtimeNumeric('db', -6)
            },
            trigger: () => [
              {
                envelope: SIMPLE_CURVE,
                source: {
                  type: 'oscillator',
                  shape: 'sine',
                  frequency: 440 as Numeric<'hz'>
                },
                duration: 1 as Numeric<'s'>
              }
            ]
          } satisfies Instrument
        ]
      ]),

      automations: new Map(),
      assets: new Map(),

      track: {
        tempo: 120 as Numeric<'bpm'>,
        parts: []
      } satisfies Track,

      mixer: {
        buses: [
          {
            id: busId,
            name: 'Bus 1',
            gain: {
              id: busGainId,
              initial: runtimeNumeric('db', -3)
            },
            pan: {
              id: 500 as ParameterId,
              initial: runtimeNumeric(undefined, 0)
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
            initial: runtimeNumeric(undefined, dbToGain(-3 as Numeric<'db'>)),
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
            initial: runtimeNumeric(undefined, dbToGain(-6 as Numeric<'db'>)),
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
      velocity: 1 as Numeric<undefined>,
      gate: 1 as Numeric<'beats'>
    })

    assert.strictEqual(voices.length, 1)
    const [voice] = voices

    assert.deepStrictEqual(voice, {
      type: 'oscillator',
      shape: 'sine',
      frequency: 440 as Numeric<'hz'>,
      duration: 1 as Numeric<'s'>, // 0.5s for the note + 0.5s for the release
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
              initial: runtimeNumeric('db', -6)
            },
            trigger: () => []
          } satisfies Instrument
        ]
      ]),

      automations: new Map([
        [
          instrumentGainId,
          {
            initial: runtimeNumeric('db', -6),
            points: [
              {
                time: runtimeNumeric('s', 0.5),
                value: runtimeNumeric('db', -3),
                shape: 'linear'
              },
              {
                time: runtimeNumeric('s', 1),
                value: runtimeNumeric('db', -12),
                shape: 'step'
              }
            ]
          }
        ]
      ]),

      assets: new Map(),

      track: {
        tempo: 120 as Numeric<'bpm'>,
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
        initial: runtimeNumeric(undefined, dbToGain(-6 as Numeric<'db'>)),
        points: [
          {
            time: runtimeNumeric('s', 0.5),
            value: runtimeNumeric(undefined, dbToGain(-3 as Numeric<'db'>)),
            shape: 'exponential'
          },
          {
            time: runtimeNumeric('s', 1),
            value: runtimeNumeric(undefined, dbToGain(-12 as Numeric<'db'>)),
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
              initial: runtimeNumeric('db', -6)
            },
            trigger: () => []
          } satisfies Instrument
        ]
      ]),

      automations: new Map(),
      assets: new Map(),

      track: {
        tempo: 120 as Numeric<'bpm'>,
        parts: [
          {
            name: 'Part 1',
            length: 4 as Numeric<'beats'>,
            routings: [
              {
                source: {
                  type: 'pattern',
                  value: createSerialPattern([
                    { value: 'C4' },
                    { value: 'E4', velocity: 0.75 as Numeric<undefined> }
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
            length: 4 as Numeric<'beats'>,
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
        initial: runtimeNumeric('db', -Infinity)
      },
      trigger: () => []
    })

    assert.doesNotThrow(() => createAudioGraph(program))
  })

  it('should throw for invalid instrument gain', () => {
    for (const gain of [Infinity, Number.NaN]) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          initial: runtimeNumeric('db', gain)
        },
        trigger: () => []
      })

      assert.throws(() => createAudioGraph(program), /Invalid gain/, `should throw for gain: ${gain}`)
    }
  })

  it('should lower dB curves into gain space', () => {
    const testCases: Array<Curve<'s', 'db'>> = [
      {
        initial: runtimeNumeric('db', -Infinity),
        points: [
          { time: runtimeNumeric('s', 0), value: runtimeNumeric('db', 0), shape: 'step' }
        ]
      },
      {
        initial: runtimeNumeric('db', -12),
        points: [
          { time: runtimeNumeric('s', 0.25), value: runtimeNumeric('db', -6), shape: 'linear' },
          { time: runtimeNumeric('s', 0.5), value: runtimeNumeric('db', -18), shape: 'step' }
        ]
      },
      SIMPLE_CURVE
    ]

    const note: NoteData = {
      pitch: 'C4',
      velocity: 1 as Numeric<undefined>,
      gate: 16 as Numeric<'beats'>
    }

    for (const curve of testCases) {
      const program = createProgramWithInstrument({
        id: 100 as InstrumentId,
        gain: {
          id: 200 as ParameterId,
          initial: runtimeNumeric('db', -6)
        },
        trigger: () => [
          {
            envelope: curve,
            source: {
              type: 'oscillator',
              shape: 'sine',
              frequency: 440 as Numeric<'hz'>
            }
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
      envelope: SIMPLE_CURVE,
      source: {
        type: 'oscillator',
        shape: 'sine',
        frequency
      },
      duration
    } as const)

    const program = createProgramWithInstrument({
      id: 100 as InstrumentId,
      gain: {
        id: 200 as ParameterId,
        initial: runtimeNumeric('db', -6)
      },
      trigger: () => [
        makeVoice(100 as Numeric<'hz'>, -1 as Numeric<'s'>),
        makeVoice(200 as Numeric<'hz'>, 0 as Numeric<'s'>),
        makeVoice(300 as Numeric<'hz'>, 1 as Numeric<'s'>),
        makeVoice(400 as Numeric<'hz'>, undefined)
      ]
    })

    const graph = createAudioGraph(program)

    const instrumentNode = graph.nodes.get(2 as NodeId) as InstrumentNode
    const voices = instrumentNode.trigger({
      pitch: 'C4',
      velocity: 1 as Numeric<undefined>,
      gate: 1 as Numeric<'beats'>
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
          initial: runtimeNumeric('db', -6)
        },
        trigger: () => [
          {
            envelope: SIMPLE_CURVE,
            source: {
              type: 'sample',
              assetId: 300 as AssetId,
              length: -1 as Numeric<'s'>,
              playbackRate: playbackRate as Numeric<undefined>
            }
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
          velocity: 1 as Numeric<undefined>,
          gate: 1 as Numeric<'beats'>
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
          initial: runtimeNumeric('db', -6)
        },
        trigger: () => [
          {
            envelope: SIMPLE_CURVE,
            source: {
              type: 'oscillator',
              shape: 'sine',
              frequency: frequency as Numeric<'hz'>
            }
          }
        ]
      })

      const graph = createAudioGraph(program)
      const instrumentNode = graph.nodes.get(2 as NodeId) as InstrumentNode

      assert.throws(() => {
        instrumentNode.trigger({
          pitch: 'C4',
          velocity: 1 as Numeric<undefined>,
          gate: 1 as Numeric<'beats'>
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
            initial: runtimeNumeric('db', -3)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'gain',
          gain: {
            initial: runtimeNumeric(undefined, dbToGain(-3 as Numeric<'db'>)),
            points: []
          }
        } satisfies GainNode)
      })

      it('should allow negative infinity gain', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'gain',
          gain: {
            id: 400 as ParameterId,
            initial: runtimeNumeric('db', -Infinity)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'gain',
          gain: {
            initial: runtimeNumeric(undefined, 0),
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
              initial: runtimeNumeric('db', gain)
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
            initial: runtimeNumeric(undefined, 0.5)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'pan',
          pan: {
            initial: runtimeNumeric(undefined, 0.5),
            points: []
          }
        } satisfies PanNode)
      })

      it('should clamp pan to [-1, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: runtimeNumeric(undefined, Infinity)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'pan',
          pan: {
            initial: runtimeNumeric(undefined, 1),
            points: []
          }
        } satisfies PanNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: runtimeNumeric(undefined, -Infinity)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'pan',
          pan: {
            initial: runtimeNumeric(undefined, -1),
            points: []
          }
        } satisfies PanNode)
      })

      it('should throw for NaN pan', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'pan',
          pan: {
            id: 500 as ParameterId,
            initial: runtimeNumeric(undefined, Number.NaN)
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
            initial: runtimeNumeric('hz', 1000)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'lowpass',
          frequency: {
            initial: runtimeNumeric('hz', 1000),
            points: []
          },
          rolloffPerOctave: 12 as Numeric<'db'>
        } satisfies BiquadNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'lowpass',
          frequency: {
            id: 600 as ParameterId,
            initial: runtimeNumeric('hz', -100)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'lowpass',
          frequency: {
            initial: runtimeNumeric('hz', 0),
            points: []
          },
          rolloffPerOctave: 12 as Numeric<'db'>
        } satisfies BiquadNode)
      })

      it('should throw for invalid lowpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'lowpass',
            frequency: {
              id: 600 as ParameterId,
              initial: runtimeNumeric('hz', frequency)
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
            initial: runtimeNumeric('hz', 500)
          }
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'highpass',
          frequency: {
            initial: runtimeNumeric('hz', 500),
            points: []
          },
          rolloffPerOctave: 12 as Numeric<'db'>
        } satisfies BiquadNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'highpass',
          frequency: {
            id: 600 as ParameterId,
            initial: runtimeNumeric('hz', -100)
          }
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'biquad',
          filterType: 'highpass',
          frequency: {
            initial: runtimeNumeric('hz', 0),
            points: []
          },
          rolloffPerOctave: 12 as Numeric<'db'>
        } satisfies BiquadNode)
      })

      it('should throw for invalid highpass frequency', () => {
        for (const frequency of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'highpass',
            frequency: {
              id: 600 as ParameterId,
              initial: runtimeNumeric('hz', frequency)
            }
          })), /Invalid frequency/, `should throw for frequency: ${frequency}`)
        }
      })
    })

    describe('width effect', () => {
      it('should handle width', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: runtimeNumeric(undefined, 0.75)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'width',
          width: 0.75 as Numeric<undefined>
        } satisfies WidthNode)
      })

      it('should clamp width to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: runtimeNumeric(undefined, Infinity)
        }))
        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'width',
          width: 1 as Numeric<undefined>
        } satisfies WidthNode)

        const graph2 = createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: runtimeNumeric(undefined, -Infinity)
        }))
        assert.deepStrictEqual(graph2.nodes.get(2 as NodeId), {
          type: 'width',
          width: 0 as Numeric<undefined>
        } satisfies WidthNode)
      })

      it('should throw for NaN width', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'width',
          width: runtimeNumeric(undefined, Number.NaN)
        })), /Invalid width/)
      })
    })

    describe('delay effect', () => {
      it('should handle delay', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: runtimeNumeric(undefined, 0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, 0.4)
          },
          wet: runtimeNumeric('db', 0)
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
              time: beatsToSeconds(0.5 as Numeric<'beats'>, 120 as Numeric<'bpm'>)
            } satisfies DelayNode
          ],
          // feedback gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: runtimeNumeric(undefined, 0.4),
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
                initial: runtimeNumeric(undefined, 1.0),
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
                initial: runtimeNumeric(undefined, 0.5),
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
          mix: runtimeNumeric(undefined, Infinity),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, 0.4)
          },
          wet: runtimeNumeric('db', 0)
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
              time: beatsToSeconds(0.5 as Numeric<'beats'>, 120 as Numeric<'bpm'>)
            } satisfies DelayNode
          ],
          // feedback gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: runtimeNumeric(undefined, 0.4),
                points: []
              }
            } satisfies GainNode
          ]
        ])
      })

      it('should throw for NaN delay mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: runtimeNumeric(undefined, Number.NaN),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, 0.4)
          },
          wet: runtimeNumeric('db', 0)
        })), /Invalid mix/)
      })

      it('should throw for invalid delay time', () => {
        for (const time of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'delay',
            mix: runtimeNumeric(undefined, 0.25),
            time: runtimeNumeric('beats', time),
            feedback: {
              id: 400 as ParameterId,
              initial: runtimeNumeric(undefined, 0.4)
            },
            wet: runtimeNumeric('db', 0)
          })), /Invalid time/, `should throw for time: ${time}`)
        }
      })

      it('should clamp delay feedback to [0, 1]', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: runtimeNumeric(undefined, 0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, Infinity)
          },
          wet: runtimeNumeric('db', 0)
        }))

        assert.deepStrictEqual(graph.nodes.get(3 as NodeId), {
          type: 'gain',
          gain: {
            initial: runtimeNumeric(undefined, 1),
            points: []
          }
        } satisfies GainNode)
      })

      it('should throw for NaN delay feedback', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: runtimeNumeric(undefined, 0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, Number.NaN)
          },
          wet: runtimeNumeric('db', 0)
        })), /Invalid feedback/)
      })

      it('should handle delay specified in seconds', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: runtimeNumeric(undefined, 0.25),
          time: runtimeNumeric('s', 1.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, 0.4)
          },
          wet: runtimeNumeric('db', 0)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'delay',
          time: 1.5 as Numeric<'s'>
        } satisfies DelayNode)
      })

      it('should add a gain node for non-zero wet level', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'delay',
          mix: runtimeNumeric(undefined, 0.25),
          time: runtimeNumeric('beats', 0.5),
          feedback: {
            id: 400 as ParameterId,
            initial: runtimeNumeric(undefined, 0.4)
          },
          wet: runtimeNumeric('db', -6)
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
              time: beatsToSeconds(0.5 as Numeric<'beats'>, 120 as Numeric<'bpm'>)
            } satisfies DelayNode
          ],
          // feedback gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: runtimeNumeric(undefined, 0.4),
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
                initial: runtimeNumeric(undefined, dbToGain(-6 as Numeric<'db'>)),
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
                initial: runtimeNumeric(undefined, 1.0),
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
                initial: runtimeNumeric(undefined, 0.5),
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
            mix: runtimeNumeric(undefined, 0.25),
            time: runtimeNumeric('beats', 0.5),
            feedback: {
              id: 400 as ParameterId,
              initial: runtimeNumeric(undefined, 0.4)
            },
            wet: runtimeNumeric('db', wet)
          })), /Invalid gain/, `should throw for wet level: ${wet}`)
        }
      })
    })

    describe('reverb effect', () => {
      it('should handle reverb', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: runtimeNumeric(undefined, 0.75),
          decay: runtimeNumeric('s', 2),
          wet: runtimeNumeric('db', 0)
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
              decay: 2 as Numeric<'s'>
            } satisfies ReverbNode
          ],
          // dry gain node
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: runtimeNumeric(undefined, 0.5),
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
                initial: runtimeNumeric(undefined, 1.0),
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
          mix: runtimeNumeric(undefined, 1.5),
          decay: runtimeNumeric('s', 2),
          wet: runtimeNumeric('db', 0)
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
              decay: 2 as Numeric<'s'>
            } satisfies ReverbNode
          ]
        ])
      })

      it('should throw for NaN reverb mix', () => {
        assert.throws(() => createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: runtimeNumeric(undefined, Number.NaN),
          decay: runtimeNumeric('s', 2),
          wet: runtimeNumeric('db', 0)
        })), /Invalid mix/)
      })

      it('should throw for invalid reverb decay', () => {
        for (const decay of [Infinity, -Infinity, Number.NaN]) {
          assert.throws(() => createAudioGraph(createProgramWithEffect({
            type: 'reverb',
            mix: runtimeNumeric(undefined, 0.75),
            decay: runtimeNumeric('s', decay),
            wet: runtimeNumeric('db', 0)
          })), /Invalid decay/, `should throw for decay: ${decay}`)
        }
      })

      it('should handle reverb specified in beats', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: runtimeNumeric(undefined, 0.75),
          decay: runtimeNumeric('beats', 2),
          wet: runtimeNumeric('db', 0)
        }))

        assert.deepStrictEqual(graph.nodes.get(2 as NodeId), {
          type: 'reverb',
          decay: beatsToSeconds(2 as Numeric<'beats'>, 120 as Numeric<'bpm'>)
        } satisfies ReverbNode)
      })

      it('should add a gain node for non-zero wet level', () => {
        const graph = createAudioGraph(createProgramWithEffect({
          type: 'reverb',
          mix: runtimeNumeric(undefined, 0.25),
          decay: runtimeNumeric('s', 2),
          wet: runtimeNumeric('db', -6)
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
              decay: 2 as Numeric<'s'>
            } satisfies ReverbNode
          ],
          // wet gain node for wet level
          [
            3,
            {
              type: 'gain',
              gain: {
                initial: runtimeNumeric(undefined, dbToGain(-6 as Numeric<'db'>)),
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
                initial: runtimeNumeric(undefined, 1.0),
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
                initial: runtimeNumeric(undefined, 0.5),
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
            mix: runtimeNumeric(undefined, 0.75),
            decay: runtimeNumeric('s', 2),
            wet: runtimeNumeric('db', wet)
          })), /Invalid gain/, `should throw for wet level: ${wet}`)
        }
      })
    })

    describe('clip effect', () => {
      it('should create gain, wave shaper, and makeup nodes', () => {
        const threshold = runtimeNumeric('db', -6)

        const graph = createAudioGraph(createProgramWithEffect({
          type: 'clip',
          threshold: {
            id: 400 as ParameterId,
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
                initial: runtimeNumeric(undefined, 1 / dbToGain(threshold.value)),
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
                initial: runtimeNumeric(undefined, dbToGain(threshold.value)),
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
              initial: runtimeNumeric('db', threshold)
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
          initial: runtimeNumeric('db', -6)
        },
        trigger: () => []
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
                initial: runtimeNumeric('db', -6)
              },
              trigger: () => []
            } satisfies Instrument
          ]
        ]),
        automations: new Map(),
        assets: new Map(),
        track: {
          tempo: 120 as Numeric<'bpm'>,
          parts: []
        },
        mixer: {
          buses: [
            {
              id: busId,
              name: 'Bus 1',
              gain: {
                id: 201 as ParameterId,
                initial: runtimeNumeric('db', -3)
              },
              pan: {
                id: 202 as ParameterId,
                initial: runtimeNumeric(undefined, 0)
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

      const interval = 0.123 as Numeric<'s'>

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
        initial: runtimeNumeric('db', -6)
      },
      trigger: () => []
    })

    for (const interval of [Infinity, -Infinity, Number.NaN, 0, -1]) {
      const options = {
        metering: {
          interval: interval as Numeric<'s'>
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
