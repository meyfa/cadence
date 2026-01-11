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
        sections: []
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
          sections: []
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
          sections: []
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
          sections: []
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
          library: ast.make('String', RANGE, { value: 'effects' })
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
          sections: []
        })
      ]
    })
    assert.doesNotThrow(() => generate(program, OPTIONS))
  })

  it('should support shadowing of imported names', () => {
    const program = ast.make('Program', RANGE, {
      imports: [
        ast.make('UseStatement', RANGE, {
          library: ast.make('String', RANGE, { value: 'effects' })
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
          sections: []
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 140))
  })

  it('should allow sections and buses to shadow top-level variables', () => {
    const program = ast.make('Program', RANGE, {
      imports: [],
      children: [
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'foo' }),
          value: ast.make('Number', RANGE, { value: 42 })
        }),
        ast.make('TrackStatement', RANGE, {
          properties: [],
          sections: [
            ast.make('SectionStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              length: ast.make('Number', RANGE, { value: 4, unit: 'bars' }),
              properties: [],
              routings: []
            })
          ]
        }),
        ast.make('MixerStatement', RANGE, {
          properties: [],
          routings: [],
          buses: [
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [],
              effects: []
            })
          ]
        })
      ]
    })
    const result = generate(program, OPTIONS)
    assert.deepStrictEqual(result.track.sections[0].name, 'foo')
    assert.deepStrictEqual(result.mixer.buses[0].name, 'foo')
  })
})
