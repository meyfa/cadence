import { getEmptySourceRange } from '@meyfa/cadence-ast'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Emission, Slot, SlotName, Slots } from '../../../src/compiler/checker/emissions.ts'
import { addEmission, validateEmissions } from '../../../src/compiler/checker/emissions.ts'
import { NumberFacet } from '../../../src/type-system/base/number.ts'
import { SourceFacet } from '../../../src/type-system/domain/source.ts'

describe('compiler/checker/emissions.ts', () => {
  describe('addEmission()', () => {
    it('should merge compatible emissions for the same slot', () => {
      const target = new Map<SlotName, Emission>()

      const outputSlot: Slot = {
        name: 'output' as SlotName,
        type: NumberFacet.with('hz').type()
      }

      const firstRange = getEmptySourceRange()
      const secondRange = { ...getEmptySourceRange(), offset: 10, column: 11 }

      const first = addEmission(target, {
        slot: outputSlot,
        minimum: 1,
        maximum: 1,
        ranges: [firstRange]
      })
      assert.deepStrictEqual(first, [])

      const second = addEmission(target, {
        slot: outputSlot,
        minimum: 0,
        maximum: 2,
        ranges: [secondRange]
      })
      assert.deepStrictEqual(second, [])

      assert.deepStrictEqual(target.get(outputSlot.name), {
        slot: outputSlot,
        type: undefined,
        minimum: 1,
        maximum: 3,
        ranges: [firstRange, secondRange]
      })
    })

    it('should error for incompatible types', () => {
      const target = new Map<SlotName, Emission>()

      const inferredSlot: Slot = {
        name: 'inferred' as SlotName,
        type: 'infer'
      }

      const original: Emission = {
        slot: inferredSlot,
        type: NumberFacet.with('hz').type(),
        minimum: 1,
        maximum: 1,
        ranges: [getEmptySourceRange()]
      }

      const incompatible: Emission = {
        slot: inferredSlot,
        type: SourceFacet.type(),
        minimum: 1,
        maximum: 1,
        ranges: [
          { ...getEmptySourceRange(), offset: 20, column: 21 }
        ]
      }

      addEmission(target, original)
      const errors = addEmission(target, incompatible)

      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0]?.message, 'Incompatible types for slot "inferred": number.hz, source')
      assert.strictEqual(errors[0]?.range, incompatible.ranges[0])

      // The emission should still be merged.
      // This is to avoid errors about missing emissions for required slots when the type is incompatible.
      assert.deepStrictEqual(target.get(inferredSlot.name), {
        slot: inferredSlot,
        type: undefined,
        minimum: 2,
        maximum: 2,
        ranges: [...original.ranges, ...incompatible.ranges]
      })
    })
  })

  describe('validateEmissions()', () => {
    it('should reject required slots when their minimum emission count is zero', () => {
      const range = getEmptySourceRange()

      const slots: Slots = [
        { name: 'typed' as SlotName, type: NumberFacet.with('hz').type(), required: true },
        { name: 'inferred' as SlotName, type: 'infer', required: true }
      ]

      const emissions = new Map<SlotName, Emission>([
        [
          'typed' as SlotName,
          {
            slot: slots[0],
            minimum: 0,
            maximum: 1,
            ranges: [range]
          }
        ]
      ])

      assert.deepStrictEqual(
        validateEmissions(emissions, slots, range).map((error) => error.message),
        [
          'Expected at least one emission into slot "typed" of type number.hz',
          'Expected at least one emission into slot "inferred"'
        ]
      )
    })

    it('should not handle exceeding the maximum for singular slots', () => {
      // Reason: The maximum has already been validated when adding emissions.

      const range = getEmptySourceRange()

      const slots: Slots = [
        { name: 'typed' as SlotName, type: NumberFacet.with('hz').type(), singular: true },
        { name: 'inferred' as SlotName, type: 'infer', singular: true }
      ]

      const emissions = new Map<SlotName, Emission>([
        [
          'typed' as SlotName,
          {
            slot: slots[0],
            minimum: 1,
            maximum: 2,
            ranges: [range]
          }
        ],
        [
          'inferred' as SlotName,
          {
            slot: slots[1],
            type: SourceFacet.type(),
            minimum: 1,
            maximum: 3,
            ranges: [range]
          }]
      ])

      assert.deepStrictEqual(
        validateEmissions(emissions, slots, range),
        []
      )
    })
  })
})
