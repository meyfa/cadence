import assert from 'node:assert'
import { describe, it } from 'node:test'
import { isPitch, isStepValue } from '../../src/pattern/types.ts'

describe('pattern/types.ts', () => {
  const validPitches = ['C4', 'A#0', 'Bb10']
  const invalidPitches = ['', 'H4', 'C11', 'A#', 'A#-1', '4', 'c4']
  const validStepValues = ['-', 'x', ...validPitches]
  const invalidStepValues = ['', 'z', '_', '- ', ' -', ...invalidPitches]

  describe('isPitch()', () => {
    it('should return true for valid pitch', () => {
      for (const pitch of validPitches) {
        assert.strictEqual(isPitch(pitch), true)
      }
    })

    it('should return false for invalid pitch', () => {
      for (const pitch of invalidPitches) {
        assert.strictEqual(isPitch(pitch), false)
      }
    })
  })

  describe('isStepValue()', () => {
    it('should return true for valid step value', () => {
      for (const stepValue of validStepValues) {
        assert.strictEqual(isStepValue(stepValue), true)
      }
    })

    it('should return false for invalid step value', () => {
      for (const stepValue of invalidStepValues) {
        assert.strictEqual(isStepValue(stepValue), false)
      }
    })
  })
})
