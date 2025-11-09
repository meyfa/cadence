import { describe, it } from 'node:test'
import { randomId } from '../../src/utilities/id.js'
import assert from 'node:assert'

describe('utilities/id.ts', () => {
  describe('randomId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set<string>()

      for (let i = 0; i < 10; i++) {
        const id = randomId()
        assert.strictEqual(ids.has(id), false, `Duplicate ID generated: ${id}`)
        ids.add(id)
      }
    })

    it('should generate IDs of the correct length', () => {
      const lengths = [0, 1, 16, 1024]

      for (const length of lengths) {
        const id = randomId(length)
        assert.strictEqual(id.length, length, `ID length mismatch: expected ${length}, got ${id.length}`)
      }
    })
  })
})
