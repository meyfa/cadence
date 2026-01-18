import { makeNumeric, type Program } from '@core/program.js'
import { getEmptySourceRange } from '@language/range.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { generate } from '../../src/compiler/generator.js'
import * as ast from '../../src/parser/ast.js'

describe('compiler/generator.ts', () => {
  const RANGE = getEmptySourceRange()

  const OPTIONS = {
    tempo: {
      default: 120,
      minimum: 1,
      maximum: 300
    },
    beatsPerBar: 4
  }

  it('should produce a correct empty program', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: []
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result, {
      beatsPerBar: 4,
      instruments: new Map(),
      track: {
        tempo: makeNumeric('bpm', 120),
        parts: []
      },
      mixer: {
        buses: [],
        routings: []
      }
    } satisfies Program)
  })

  it('should set track tempo from AST', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('Number', RANGE, { value: 140, unit: 'bpm' })
            })
          ],
          parts: []
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 140))
  })

  it('should clamp track tempo to maximum', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('Number', RANGE, { value: 400, unit: 'bpm' })
            })
          ],
          parts: []
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 300))
  })

  it('should support tempo from a variable', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        // foo = 90 bpm
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'foo' }),
          value: ast.make('Number', RANGE, { value: 90, unit: 'bpm' })
        }),
        // bar = foo * 2
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'bar' }),
          value: ast.make('BinaryExpression', RANGE, {
            operator: '*',
            left: ast.make('Identifier', RANGE, { name: 'foo' }),
            right: ast.make('Number', RANGE, { value: 2, unit: undefined })
          })
        }),
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('Identifier', RANGE, { name: 'bar' })
            })
          ],
          parts: []
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 180))
  })

  it('should support imported names', () => {
    const program = ast.make('Program', RANGE, {
      imports: [
        ast.make('UseStatement', RANGE, {
          library: ast.make('String', RANGE, { parts: ['effects'] })
        })
      ],
      children: [
        // mygain = gain
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'mygain' }),
          value: ast.make('Identifier', RANGE, { name: 'gain' })
        }),
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('Identifier', RANGE, { name: 'mygain' })
            })
          ],
          parts: []
        })
      ]
    })
    assert.doesNotThrow(() => generate(program, OPTIONS))
  })

  it('should support import aliases', () => {
    const program = ast.make('Program', RANGE, {
      imports: [
        ast.make('UseStatement', RANGE, {
          library: ast.make('String', RANGE, { parts: ['effects'] }),
          alias: 'fx'
        })
      ],
      children: [
        // mygain = fx.gain
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'mygain' }),
          value: ast.make('PropertyAccess', RANGE, {
            object: ast.make('Identifier', RANGE, { name: 'fx' }),
            property: ast.make('Identifier', RANGE, { name: 'gain' })
          })
        })
      ]
    })
    assert.doesNotThrow(() => generate(program, OPTIONS))
  })

  it('should support shadowing of imported names', () => {
    const program = ast.make('Program', RANGE, {
      imports: [
        ast.make('UseStatement', RANGE, {
          library: ast.make('String', RANGE, { parts: ['effects'] })
        })
      ],
      children: [
        // gain = 140 bpm
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'gain' }),
          value: ast.make('Number', RANGE, { value: 140, unit: 'bpm' })
        }),
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('Identifier', RANGE, { name: 'gain' })
            })
          ],
          parts: []
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 140))
  })

  it('should allow parts and buses to shadow top-level variables', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'foo' }),
          value: ast.make('Number', RANGE, { value: 42 })
        }),
        ast.make('TrackStatement', RANGE, {
          properties: [],
          parts: [
            ast.make('PartStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [
                ast.make('Number', RANGE, { value: 4, unit: 'bars' })
              ],
              routings: []
            })
          ]
        }),
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: [
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [],
              sources: [],
              effects: []
            })
          ]
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.parts[0].name, 'foo')
    assert.deepStrictEqual(result.mixer.buses[0].name, 'foo')
  })

  it('should clamp negative part lengths to 0', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('TrackStatement', RANGE, {
          properties: [],
          parts: [
            ast.make('PartStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'intro' }),
              properties: [
                ast.make('Number', RANGE, { value: -4, unit: 'bars' })
              ],
              routings: []
            })
          ]
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.parts[0].length, makeNumeric('beats', 0))
  })

  it('should support buses as sources in mixer', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          buses: [
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'bus1' }),
              properties: [],
              sources: [
                ast.make('Identifier', RANGE, { name: 'bus2' })
              ],
              effects: []
            }),
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'bus2' }),
              properties: [],
              sources: [],
              effects: []
            })
          ]
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.mixer.routings, [
      {
        implicit: false,
        destination: { type: 'Bus', id: 0 },
        source: { type: 'Bus', id: 1 }
      },
      {
        implicit: true,
        destination: { type: 'Output' },
        source: { type: 'Bus', id: 0 }
      }
    ])
  })
})
