import assert from 'node:assert'
import { describe, it } from 'node:test'
import { parse } from '../../src/parser/parser.js'
import { getEmptySourceRange } from '@language/range.js'
import * as ast from '../../src/parser/ast.js'

describe('parser/parser.ts', () => {
  it('should accept empty input', () => {
    const result = parse([])
    assert.deepStrictEqual(result, {
      complete: true,
      value: ast.make('Program', getEmptySourceRange(), {
        children: []
      })
    })
  })

  it('should parse a simple assignment', () => {
    const result = parse([
      { name: 'word', text: 'foo', offset: 0, len: 3, line: 1, column: 1, state: '' },
      { name: '=', text: '=', offset: 4, len: 1, line: 1, column: 5, state: '' },
      { name: 'number', text: '42', offset: 6, len: 2, line: 1, column: 7, state: '' }
    ])
    assert.deepStrictEqual(result, {
      complete: true,
      value: ast.make('Program', { offset: 0, length: 8, line: 1, column: 1 }, {
        children: [
          ast.make('Assignment', { offset: 0, length: 8, line: 1, column: 1 }, {
            key: ast.make('Identifier', { offset: 0, length: 3, line: 1, column: 1 }, { name: 'foo' }),
            value: ast.make('NumberLiteral', { offset: 6, length: 2, line: 1, column: 7 }, { value: 42, unit: undefined })
          })
        ]
      })
    })
  })

  it('should parse a pattern', () => {
    const result = parse([
      { name: 'word', text: 'foo', offset: 0, len: 3, line: 1, column: 1, state: '' },
      { name: '=', text: '=', offset: 4, len: 1, line: 1, column: 5, state: '' },
      { name: '[', text: '[', offset: 5, len: 1, line: 1, column: 6, state: '' },
      { name: 'word', text: 'xx', offset: 6, len: 2, line: 1, column: 7, state: '' },
      { name: '-', text: '-', offset: 8, len: 1, line: 1, column: 9, state: '' },
      { name: 'word', text: 'D4', offset: 9, len: 2, line: 1, column: 10, state: '' },
      { name: ':', text: ':', offset: 11, len: 1, line: 1, column: 12, state: '' },
      { name: 'number', text: '0.5', offset: 12, len: 3, line: 1, column: 13, state: '' },
      { name: '-', text: '-', offset: 15, len: 1, line: 1, column: 16, state: '' },
      { name: 'word', text: 'G4', offset: 16, len: 2, line: 1, column: 17, state: '' },
      { name: ']', text: ']', offset: 18, len: 1, line: 1, column: 19, state: '' }
    ])
    assert.deepStrictEqual(result, {
      complete: true,
      value: ast.make('Program', { offset: 0, length: 19, line: 1, column: 1 }, {
        children: [
          ast.make('Assignment', { offset: 0, length: 19, line: 1, column: 1 }, {
            key: ast.make('Identifier', { offset: 0, length: 3, line: 1, column: 1 }, { name: 'foo' }),
            value: ast.make('Pattern', { offset: 5, length: 14, line: 1, column: 6 }, {
              steps: [
                ast.make('Step', { offset: 6, length: 1, line: 1, column: 7 }, { value: 'x' }),
                ast.make('Step', { offset: 7, length: 1, line: 1, column: 8 }, { value: 'x' }),
                ast.make('Step', { offset: 8, length: 1, line: 1, column: 9 }, { value: '-' }),
                ast.make('Step', { offset: 9, length: 6, line: 1, column: 10 }, {
                  value: 'D4',
                  length: ast.make('NumberLiteral', { offset: 12, length: 3, line: 1, column: 13 }, { value: 0.5, unit: undefined })
                }),
                ast.make('Step', { offset: 15, length: 1, line: 1, column: 16 }, { value: '-' }),
                ast.make('Step', { offset: 16, length: 2, line: 1, column: 17 }, { value: 'G4' })
              ]
            })
          })
        ]
      })
    })
  })

  it('should parse a pattern with gate', () => {
    const result = parse([
      { name: 'word', text: 'pattern', offset: 0, len: 7, line: 1, column: 1, state: '' },
      { name: '=', text: '=', offset: 8, len: 1, line: 1, column: 9, state: '' },
      { name: '[', text: '[', offset: 10, len: 1, line: 1, column: 11, state: '' },
      { name: 'word', text: 'C4', offset: 11, len: 2, line: 1, column: 12, state: '' },
      { name: '(', text: '(', offset: 13, len: 1, line: 1, column: 14, state: '' },
      { name: 'number', text: '2.0', offset: 14, len: 3, line: 1, column: 15, state: '' },
      { name: ')', text: ')', offset: 17, len: 1, line: 1, column: 18, state: '' },
      { name: '-', text: '-', offset: 18, len: 1, line: 1, column: 19, state: '' },
      { name: ']', text: ']', offset: 19, len: 1, line: 1, column: 20, state: '' }
    ])
    assert.deepStrictEqual(result, {
      complete: true,
      value: ast.make('Program', { offset: 0, length: 20, line: 1, column: 1 }, {
        children: [
          ast.make('Assignment', { offset: 0, length: 20, line: 1, column: 1 }, {
            key: ast.make('Identifier', { offset: 0, length: 7, line: 1, column: 1 }, { name: 'pattern' }),
            value: ast.make('Pattern', { offset: 10, length: 10, line: 1, column: 11 }, {
              steps: [
                ast.make('Step', { offset: 11, length: 7, line: 1, column: 12 }, {
                  value: 'C4',
                  gate: ast.make('NumberLiteral', { offset: 14, length: 3, line: 1, column: 15 }, { value: 2.0, unit: undefined })
                }),
                ast.make('Step', { offset: 18, length: 1, line: 1, column: 19 }, { value: '-' })
              ]
            })
          })
        ]
      })
    })
  })

  it('should parse a pattern with gate and length', () => {
    const result = parse([
      { name: 'word', text: 'pattern', offset: 0, len: 7, line: 1, column: 1, state: '' },
      { name: '=', text: '=', offset: 8, len: 1, line: 1, column: 9, state: '' },
      { name: '[', text: '[', offset: 10, len: 1, line: 1, column: 11, state: '' },
      { name: 'word', text: 'C4', offset: 11, len: 2, line: 1, column: 12, state: '' },
      { name: '(', text: '(', offset: 13, len: 1, line: 1, column: 14, state: '' },
      { name: 'number', text: '2.0', offset: 14, len: 3, line: 1, column: 15, state: '' },
      { name: ')', text: ')', offset: 17, len: 1, line: 1, column: 18, state: '' },
      { name: ':', text: ':', offset: 18, len: 1, line: 1, column: 19, state: '' },
      { name: 'number', text: '1.5', offset: 19, len: 3, line: 1, column: 20, state: '' },
      { name: '-', text: '-', offset: 22, len: 1, line: 1, column: 23, state: '' },
      { name: ']', text: ']', offset: 23, len: 1, line: 1, column: 24, state: '' }
    ])
    assert.deepStrictEqual(result, {
      complete: true,
      value: ast.make('Program', { offset: 0, length: 24, line: 1, column: 1 }, {
        children: [
          ast.make('Assignment', { offset: 0, length: 24, line: 1, column: 1 }, {
            key: ast.make('Identifier', { offset: 0, length: 7, line: 1, column: 1 }, { name: 'pattern' }),
            value: ast.make('Pattern', { offset: 10, length: 14, line: 1, column: 11 }, {
              steps: [
                ast.make('Step', { offset: 11, length: 11, line: 1, column: 12 }, {
                  value: 'C4',
                  gate: ast.make('NumberLiteral', { offset: 14, length: 3, line: 1, column: 15 }, { value: 2.0, unit: undefined }),
                  length: ast.make('NumberLiteral', { offset: 19, length: 3, line: 1, column: 20 }, { value: 1.5, unit: undefined })
                }),
                ast.make('Step', { offset: 22, length: 1, line: 1, column: 23 }, { value: '-' })
              ]
            })
          })
        ]
      })
    })
  })
})
