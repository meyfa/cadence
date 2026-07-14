import assert from 'node:assert'
import { describe, it } from 'node:test'
import { NumberFacet } from '../../src/type-system/base/number.ts'
import { StringFacet } from '../../src/type-system/base/string.ts'
import { makeSchema } from '../../src/type-system/schema.ts'

describe('type-system/schema.ts', () => {
  describe('makeSchema()', () => {
    it('creates a schema with items and byName map', () => {
      const foo = { name: 'foo', type: NumberFacet.with('hz').type(), required: true }
      const bar = { name: 'bar', type: StringFacet.type(), required: false }

      const schema = makeSchema([foo, bar])

      assert.strictEqual(schema.items.length, 2)
      assert.strictEqual(schema.items[0], foo)
      assert.strictEqual(schema.items[1], bar)

      assert.strictEqual(schema.byName.size, 2)
      assert.strictEqual(schema.byName.get('foo'), foo)
      assert.strictEqual(schema.byName.get('bar'), bar)
    })

    it('should throw when given duplicate item names', () => {
      const item1 = { name: 'duplicate', type: NumberFacet.with('hz').type(), required: true }
      const item2 = { name: 'duplicate', type: StringFacet.type(), required: false }

      assert.throws(() => makeSchema([item1, item2]), /Duplicate item names in schema/)
    })

    it('allows empty schema', () => {
      const schema = makeSchema([])

      assert.strictEqual(schema.items.length, 0)
      assert.strictEqual(schema.byName.size, 0)
    })
  })
})
