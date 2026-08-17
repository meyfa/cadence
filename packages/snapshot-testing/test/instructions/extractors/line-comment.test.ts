import assert from 'node:assert'
import { describe, it } from 'node:test'
import { fromLineComment } from '../../../src/instructions/extractors/line-comment.ts'
import type { Instruction } from '../../../src/types.ts'

describe('instructions/extractors/line-comment.ts', () => {
  it('extracts instructions from line comments', () => {
    const input = [
      '// test:get_property ["foo"]',
      '// test:get_property ["bar"]',
      'other input',
      '// test:get_property ["baz"]',
      ''
    ].join('\n')

    assert.deepStrictEqual(fromLineComment(input), [
      {
        type: 'get_property',
        argument: ['foo']
      },
      {
        type: 'get_property',
        argument: ['bar']
      },
      {
        type: 'get_property',
        argument: ['baz']
      }
    ] satisfies Instruction[])
  })

  it('handles different spacing', () => {
    const testCases = [
      '//test:get_property ["foo"]',
      '//   test:get_property ["foo"]',
      '// test:  get_property ["foo"]',
      '// test:get_property   ["foo"]',
      '// test:get_property ["foo"]   '
    ]

    for (const testCase of testCases) {
      assert.deepStrictEqual(fromLineComment(testCase), [
        {
          type: 'get_property',
          argument: ['foo']
        }
      ] satisfies Instruction[])
    }
  })

  it('ignores non-test line comments', () => {
    const input = [
      '// test comment',
      '// some other comment',
      'foo = bar // test:not_at_beginning_of_line',
      ''
    ].join('\n')

    assert.deepStrictEqual(fromLineComment(input), [])
  })
})
