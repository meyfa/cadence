import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getEdgeStyle } from '../src/style.ts'

describe('style.ts', () => {
  describe('getEdgeStyle()', () => {
    it('returns the default style when no overrides are given', () => {
      assert.deepStrictEqual(getEdgeStyle(), {
        stroke: '#000',
        strokeWidth: 2,
        strokeDasharray: undefined,
        markerEnd: undefined
      })
    })

    it('applies a single override on top of the default style', () => {
      assert.deepStrictEqual(getEdgeStyle({ stroke: '#f00' }), {
        stroke: '#f00',
        strokeWidth: 2,
        strokeDasharray: undefined,
        markerEnd: undefined
      })
    })

    it('applies multiple overrides in order, later ones taking precedence', () => {
      assert.deepStrictEqual(getEdgeStyle({ stroke: '#f00', strokeWidth: 1 }, { stroke: '#0f0' }), {
        stroke: '#0f0',
        strokeWidth: 1,
        strokeDasharray: undefined,
        markerEnd: undefined
      })
    })

    it('ignores undefined overrides', () => {
      assert.deepStrictEqual(getEdgeStyle(undefined, { stroke: '#f00' }), {
        stroke: '#f00',
        strokeWidth: 2,
        strokeDasharray: undefined,
        markerEnd: undefined
      })
    })
  })
})
