import { getEmptySourceRange } from '@language/range.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { check } from '../../src/compiler/checker.js'
import * as ast from '../../src/parser/ast.js'

describe('compiler/checker.ts', () => {
  const RANGE = getEmptySourceRange()

  describe('valid', () => {
    it('should accept an empty program', () => {
      const program = ast.make('Program', RANGE, {
        children: []
      })
      const errors = check(program)
      assert.strictEqual(errors.length, 0)
    })

    it('should accept a program with one track and unique sections', () => {
      const program = ast.make('Program', RANGE, {
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [],
            sections: [
              ast.make('SectionStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                length: ast.make('NumberLiteral', RANGE, { value: 4, unit: 'bars' }),
                properties: [],
                routings: []
              }),
              ast.make('SectionStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'main' }),
                length: ast.make('NumberLiteral', RANGE, { value: 8, unit: 'bars' }),
                properties: [],
                routings: []
              })
            ]
          })
        ]
      })
      const errors = check(program)
      assert.strictEqual(errors.length, 0)
    })
  })

  describe('invalid', () => {
    it('should reject duplicate track blocks', () => {
      const program = ast.make('Program', RANGE, {
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [],
            sections: []
          }),
          ast.make('TrackStatement', RANGE, {
            properties: [],
            sections: []
          })
        ]
      })
      const errors = check(program)
      assert.strictEqual(errors.length, 1)
    })

    it('should reject duplicate section blocks within a track', () => {
      const program = ast.make('Program', RANGE, {
        children: [
          ast.make('TrackStatement', RANGE, {
            properties: [],
            sections: [
              ast.make('SectionStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                length: ast.make('NumberLiteral', RANGE, { value: 4, unit: 'bars' }),
                properties: [],
                routings: []
              }),
              ast.make('SectionStatement', RANGE, {
                name: ast.make('Identifier', RANGE, { name: 'intro' }),
                length: ast.make('NumberLiteral', RANGE, { value: 8, unit: 'bars' }),
                properties: [],
                routings: []
              })
            ]
          })
        ]
      })
      const errors = check(program)
      assert.strictEqual(errors.length, 1)
    })
  })

  it('should reject duplicate mixer blocks', () => {
    const program = ast.make('Program', RANGE, {
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          routings: [],
          buses: []
        }),
        ast.make('MixerStatement', RANGE, {
          properties: [],
          routings: [],
          buses: []
        })
      ]
    })
    const errors = check(program)
    assert.strictEqual(errors.length, 1)
  })

  it('should reject duplicate bus blocks within a mixer', () => {
    const program = ast.make('Program', RANGE, {
      children: [
        ast.make('MixerStatement', RANGE, {
          properties: [],
          routings: [],
          buses: [
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [],
              effects: []
            }),
            ast.make('BusStatement', RANGE, {
              name: ast.make('Identifier', RANGE, { name: 'foo' }),
              properties: [],
              effects: []
            })
          ]
        })
      ]
    })
    const errors = check(program)
    assert.strictEqual(errors.length, 1)
  })
})
