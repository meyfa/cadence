import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getMarkerKey, getMarkerPath } from '../src/markers.ts'

describe('markers.ts', () => {
  describe('getMarkerPath()', () => {
    it('returns the SVG path for the arrow marker', () => {
      assert.strictEqual(getMarkerPath('arrow'), 'M0,0 L0,5 L5,2.5 Z')
    })
  })

  describe('getMarkerKey()', () => {
    it('combines the marker and stroke into a unique key', () => {
      assert.strictEqual(getMarkerKey({ marker: 'arrow', stroke: '#000' }), 'arrow-#000')
    })

    it('produces different keys for different strokes', () => {
      const first = getMarkerKey({ marker: 'arrow', stroke: '#000' })
      const second = getMarkerKey({ marker: 'arrow', stroke: '#fff' })
      assert.notStrictEqual(first, second)
    })
  })
})
