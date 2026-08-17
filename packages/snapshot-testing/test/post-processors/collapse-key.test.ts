import assert from 'node:assert'
import { describe, it } from 'node:test'
import { collapseKey } from '../../src/post-processors/collapse-key.ts'

describe('post-processors/collapse-key.ts', () => {
  it('collapses the requested key', () => {
    const input = JSON.stringify({
      foo: {
        bar: 'baz',
        range: {
          x: 345,
          y: 129,
          z: 'string'
        }
      },
      range: {
        a: true,
        b: 324
      }
    }, null, 2)

    const expected = [
      '{',
      '  "foo": {',
      '    "bar": "baz",',
      '    "range": {"x": 345, "y": 129, "z": "string"}',
      '  },',
      '  "range": {"a": true, "b": 324}',
      '}'
    ].join('\n')

    const postProcess = collapseKey('range')
    const output = postProcess(input)

    assert.strictEqual(output, expected)
  })
})
