import { makeNumeric, type Program } from '@core/program.js'
import { getEmptySourceRange } from '@language/range.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { generate } from '../../src/compiler/generator.js'
import * as ast from '../../src/parser/ast.js'

describe('compiler/generator.ts', () => {
  const RANGE = getEmptySourceRange()

  it('should produce a correct empty program', () => {
    const program = ast.make('Program', RANGE, {
      children: []
    })
    const result = generate(program, {
      tempo: {
        default: 120,
        minimum: 1,
        maximum: 300
      },
      beatsPerBar: 4
    })
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
      children: [
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('NumberLiteral', RANGE, { value: 140, unit: 'bpm' })
            })
          ],
          sections: []
        })
      ]
    })
    const result = generate(program, {
      tempo: {
        default: 120,
        minimum: 1,
        maximum: 300
      },
      beatsPerBar: 4
    })
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 140))
  })

  it('should clamp track tempo to maximum', () => {
    const program = ast.make('Program', RANGE, {
      children: [
        ast.make('TrackStatement', RANGE, {
          properties: [
            ast.make('Property', RANGE, {
              key: ast.make('Identifier', RANGE, { name: 'tempo' }),
              value: ast.make('NumberLiteral', RANGE, { value: 400, unit: 'bpm' })
            })
          ],
          sections: []
        })
      ]
    })
    const result = generate(program, {
      tempo: {
        default: 120,
        minimum: 1,
        maximum: 300
      },
      beatsPerBar: 4
    })
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 300))
  })

  it('should support tempo from a variable', () => {
    const program = ast.make('Program', RANGE, {
      children: [
        // foo = 90 bpm
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'foo' }),
          value: ast.make('NumberLiteral', RANGE, { value: 90, unit: 'bpm' })
        }),
        // bar = foo * 2
        ast.make('Assignment', RANGE, {
          key: ast.make('Identifier', RANGE, { name: 'bar' }),
          value: ast.make('BinaryExpression', RANGE, {
            operator: '*',
            left: ast.make('Identifier', RANGE, { name: 'foo' }),
            right: ast.make('NumberLiteral', RANGE, { value: 2, unit: undefined })
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
    const result = generate(program, {
      tempo: {
        default: 120,
        minimum: 1,
        maximum: 300
      },
      beatsPerBar: 4
    })
    assert.deepStrictEqual(result.track.tempo, makeNumeric('bpm', 180))
  })
})
