import type { SourceRange } from '@meyfa/cadence-ast'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { checkCyclicRoutings } from '../../../src/compiler/checker/routings.js'

describe('compiler/checker/routings.ts', () => {
  const makeRange = (id: number): SourceRange => ({
    offset: id,
    length: 1,
    line: 1,
    column: id + 1
  })

  it('handles empty list of buses', () => {
    const errors = checkCyclicRoutings([])
    assert.deepStrictEqual(errors, [])
  })

  it('handles acyclic routings', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B'], range: makeRange(0) },
      { name: 'B', sources: ['C'], range: makeRange(1) },
      { name: 'C', sources: [], range: makeRange(2) }
    ])
    assert.deepStrictEqual(errors, [])
  })

  it('detects simple cycle', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B'], range: makeRange(0) },
      { name: 'B', sources: ['A'], range: makeRange(1) }
    ])
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
  })

  it('detects self-cycle', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['A'], range: makeRange(0) }
    ])
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
  })

  it('detects multiple cycles', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B'], range: makeRange(0) },
      { name: 'B', sources: ['A'], range: makeRange(1) },
      { name: 'C', sources: ['D'], range: makeRange(2) },
      { name: 'D', sources: ['C'], range: makeRange(3) }
    ])
    assert.strictEqual(errors.length, 2)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
    assert.strictEqual(errors[1].message, 'Cyclic routing: C -> D -> C')
    assert.deepStrictEqual(errors[1].range, makeRange(2))
  })

  it('ignores sources that are not buses', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B', 'X'], range: makeRange(0) },
      { name: 'B', sources: ['A', 'Y'], range: makeRange(1) }
    ])
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
  })

  it('detects complex cycle', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B'], range: makeRange(0) },
      { name: 'B', sources: ['C'], range: makeRange(1) },
      { name: 'C', sources: ['A'], range: makeRange(2) }
    ])
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> C -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
  })

  it('detects multiple cycles with shared members', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B'], range: makeRange(0) },
      { name: 'B', sources: ['C'], range: makeRange(1) },
      { name: 'C', sources: ['A', 'D'], range: makeRange(2) },
      { name: 'D', sources: ['C'], range: makeRange(3) }
    ])
    assert.strictEqual(errors.length, 2)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> C -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
    assert.strictEqual(errors[1].message, 'Cyclic routing: C -> D -> C')
    assert.deepStrictEqual(errors[1].range, makeRange(2))
  })

  it('detects reconverging cycles with different members', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B', 'C'], range: makeRange(0) },
      { name: 'B', sources: ['D'], range: makeRange(1) },
      { name: 'C', sources: ['D'], range: makeRange(2) },
      { name: 'D', sources: ['A'], range: makeRange(3) }
    ])
    assert.strictEqual(errors.length, 2)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> D -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
    assert.strictEqual(errors[1].message, 'Cyclic routing: A -> D -> C -> A')
    assert.deepStrictEqual(errors[1].range, makeRange(0))
  })

  it('renders longer cycles in source order', () => {
    const errors = checkCyclicRoutings([
      { name: 'A', sources: ['B'], range: makeRange(0) },
      { name: 'B', sources: ['C'], range: makeRange(1) },
      { name: 'C', sources: ['D'], range: makeRange(2) },
      { name: 'D', sources: ['A'], range: makeRange(3) }
    ])
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0].message, 'Cyclic routing: A -> D -> C -> B -> A')
    assert.deepStrictEqual(errors[0].range, makeRange(0))
  })
})
