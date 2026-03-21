import assert from 'node:assert'
import { describe, it } from 'node:test'
import { make } from '../src/ast.js'
import type { SourceRange } from '../src/range.js'

describe('ast/ast.ts', () => {
  describe('make()', () => {
    it('should create a node with the given type, range, and properties', () => {
      const range: SourceRange = { offset: 10, length: 3, line: 2, column: 11 }

      const node = make('Identifier', range, { name: 'tempo' })

      assert.deepStrictEqual(node, {
        type: 'Identifier',
        range,
        name: 'tempo'
      })
    })

    it('should override unsafe-cast type and range values from props', () => {
      const range: SourceRange = { offset: 6, length: 2, line: 1, column: 7 }
      const otherRange: SourceRange = { offset: 100, length: 4, line: 9, column: 1 }

      const node = make('Identifier', range, {
        name: 'gain',
        type: 'Number',
        range: otherRange
      } as any)

      assert.strictEqual(node.type, 'Identifier')
      assert.deepStrictEqual(node.range, range)
      assert.strictEqual(node.name, 'gain')
    })

    it('should create complex nodes with all required properties', () => {
      const range: SourceRange = { offset: 0, length: 8, line: 1, column: 1 }

      const node = make('Property', range, {
        key: make('Identifier', range, { name: 'volume' }),
        value: make('Number', range, { value: 0.75 })
      })

      assert.strictEqual(node.type, 'Property')
      assert.strictEqual(node.key.type, 'Identifier')
      assert.strictEqual(node.key.name, 'volume')
      assert.strictEqual(node.value.type, 'Number')
      assert.strictEqual(node.value.value, 0.75)
    })
  })
})
