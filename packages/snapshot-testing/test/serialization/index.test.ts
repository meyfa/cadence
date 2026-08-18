import assert from 'node:assert'
import { describe, it } from 'node:test'
import { serialize, deserialize } from '../../src/serialization/index.ts'

describe('serialization/index.ts', () => {
  describe('serialize', () => {
    it('serializes primitive values', () => {
      assert.strictEqual(serialize(123), '123\n')
      assert.strictEqual(serialize('foo'), '"foo"\n')
      assert.strictEqual(serialize(true), 'true\n')
      assert.strictEqual(serialize(null), 'null\n')
    })

    it('serializes undefined as null', () => {
      assert.strictEqual(serialize(undefined), 'null\n')
    })

    it('serializes special number values', () => {
      const input = {
        nan: Number.NaN,
        infinity: Infinity,
        negativeInfinity: -Infinity
      }

      const expected = [
        '{',
        '  "nan": null,',
        '  "infinity": null,',
        '  "negativeInfinity": null',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('escapes special characters in strings', () => {
      const input = {
        foo: 'bar\nbaz\tqux\\"'
      }

      const expected = [
        '{',
        '  "foo": "bar\\nbaz\\tqux\\\\\\""',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('serializes objects', () => {
      const input = {
        foo: 'bar',
        baz: 123,
        qux: true,
        nested: { a: 1, b: 2 }
      }

      const expected = [
        '{',
        '  "foo": "bar",',
        '  "baz": 123,',
        '  "qux": true,',
        '  "nested": {',
        '    "a": 1,',
        '    "b": 2',
        '  }',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('serializes arrays', () => {
      const custom = { toJSON: () => 'custom' }
      const input = [1, 2, 3, 'foo', true, null, undefined, () => {}, Symbol('baz'), custom]

      const expected = [
        '[',
        '  1,',
        '  2,',
        '  3,',
        '  "foo",',
        '  true,',
        // undefined, function, symbol
        '  null,',
        '  null,',
        '  null,',
        '  null,',
        // custom.toJSON()
        '  "custom"',
        ']',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('serializes sparse arrays', () => {
      // eslint-disable-next-line no-sparse-arrays
      const input = [1, , 3, , 5]

      const expected = [
        '[',
        '  1,',
        '  null,',
        '  3,',
        '  null,',
        '  5',
        ']',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('serializes empty objects and arrays', () => {
      const input = {
        emptyObject: {},
        emptyArray: []
      }

      const expected = [
        '{',
        '  "emptyObject": {},',
        '  "emptyArray": []',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('serializes Map and Set objects', () => {
      const input = {
        map: new Map<any, any>([
          ['foo', 'bar'],
          ['baz', 123]
        ]),
        set: new Set([1, 2, 3])
      }

      const expected = [
        '{',
        '  "map": {',
        '    "%Map%": [',
        '      [',
        '        "foo",',
        '        "bar"',
        '      ],',
        '      [',
        '        "baz",',
        '        123',
        '      ]',
        '    ]',
        '  },',
        '  "set": {',
        '    "%Set%": [',
        '      1,',
        '      2,',
        '      3',
        '    ]',
        '  }',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('serializes boxed primitive objects', () => {
      const input = {
        string: new String('foo'),
        number: new Number(123),
        boolean: new Boolean(true)
      }

      const expected = [
        '{',
        '  "string": "foo",',
        '  "number": 123,',
        '  "boolean": true',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('throws for BigInt values', () => {
      const input = {
        bigInt: BigInt('12345678901234567890')
      }

      assert.throws(() => serialize(input), {
        name: 'TypeError',
        message: 'Do not know how to serialize a BigInt'
      })
    })

    it('ignores non-enumerable properties', () => {
      const input = Object.create({}, {
        foo: { value: 'bar', enumerable: true },
        baz: { value: 123, enumerable: false }
      })

      const expected = [
        '{',
        '  "foo": "bar"',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('ignores symbols, functions, and undefined values', () => {
      const input = {
        foo: 'bar',
        [Symbol('baz')]: 123,
        symbol: Symbol('qux'),
        fn: () => {},
        undefinedValue: undefined
      }

      const expected = [
        '{',
        '  "foo": "bar"',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('handles toJSON on objects, arrays, and functions', () => {
      const input = {
        foo: 'bar',
        baz: {
          toJSON: () => ({ custom: 'value' })
        },
        qux: Object.assign([], { toJSON: () => [1, 2, 3] }),
        fn: Object.assign(() => {}, { toJSON: () => 'was a function' })
      }

      const expected = [
        '{',
        '  "foo": "bar",',
        '  "baz": {',
        '    "custom": "value"',
        '  },',
        '  "qux": [',
        '    1,',
        '    2,',
        '    3',
        '  ],',
        '  "fn": "was a function"',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('does not invoke Proxy has traps while looking up toJSON', () => {
      const input = new Proxy({ foo: 'bar' }, {
        has: () => {
          throw new Error('Unexpected has trap')
        }
      })

      const expected = [
        '{',
        '  "foo": "bar"',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('handles toJSON on Map and Set objects', () => {
      const input = {
        map: Object.assign(new Map<any, any>([
          ['foo', 'bar'],
          ['baz', 123]
        ]), {
          toJSON: () => ({ custom: 'value' })
        }),
        set: Object.assign(new Set([1, 2, 3]), {
          toJSON: () => [4, 5, 6]
        })
      }

      const expected = [
        '{',
        '  "map": {',
        '    "custom": "value"',
        '  },',
        '  "set": [',
        '    4,',
        '    5,',
        '    6',
        '  ]',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('passes key to toJSON functions', () => {
      const input = {
        foo: { toJSON: (key: string) => key },
        bar: Object.assign([], { toJSON: (key: string) => key }),
        baz: Object.assign(new Map<any, any>(), { toJSON: (key: string) => key }),
        qux: Object.assign(new Set(), { toJSON: (key: string) => key })
      }

      const expected = [
        '{',
        '  "foo": "foo",',
        '  "bar": "bar",',
        '  "baz": "baz",',
        '  "qux": "qux"',
        '}',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('passes empty string as key to toJSON for root value', () => {
      const input = {
        toJSON: (key: string) => key
      }

      assert.strictEqual(serialize(input), '""\n')
    })

    it('passes stringified key to toJSON for array elements', () => {
      const item = {
        toJSON: (key: string) => key
      }

      const input = [item, item, item]

      const expected = [
        '[',
        '  "0",',
        '  "1",',
        '  "2"',
        ']',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('ignores extra properties on arrays', () => {
      const input = Object.assign([1, 2, 3], {
        foo: 'bar',
        baz: 123
      })

      const expected = [
        '[',
        '  1,',
        '  2,',
        '  3',
        ']',
        ''
      ].join('\n')

      assert.strictEqual(serialize(input), expected)
    })

    it('can collapse certain properties onto a single line', () => {
      const input = {
        foo: {
          bar: 'baz',
          range: {
            x: 345,
            y: 129,
            z: 'string',
            nested: {
              a: 1,
              b: 2
            }
          }
        },
        range: {
          a: true,
          b: 324
        }
      }

      const expected = [
        '{',
        '  "foo": {',
        '    "bar": "baz",',
        '    "range": {"x": 345, "y": 129, "z": "string", "nested": {"a": 1, "b": 2}}',
        '  },',
        '  "range": {"a": true, "b": 324}',
        '}',
        ''
      ].join('\n')

      const requests: unknown[] = []

      const output = serialize(input, {
        shouldCollapse: (key, value) => {
          requests.push(key)
          return key === 'range' && typeof value === 'object' && value != null
        }
      })

      assert.strictEqual(output, expected)

      // Keys below "range" should not be requested, since the value is already collapsed
      assert.deepStrictEqual(requests, [undefined, 'foo', 'bar', 'range', 'range'])
    })

    it('can collapse arrays onto a single line', () => {
      const input = {
        foo: [1, 2, 3, [4, 5], 6],
        bar: {
          baz: [7, { eight: 8 }, 9]
        }
      }

      const expected = [
        '{',
        '  "foo": [1, 2, 3, [4, 5], 6],',
        '  "bar": {',
        '    "baz": [7, {"eight": 8}, 9]',
        '  }',
        '}',
        ''
      ].join('\n')

      const requests: unknown[] = []

      const output = serialize(input, {
        shouldCollapse: (key, value) => {
          requests.push(key)
          return Array.isArray(value)
        }
      })

      assert.strictEqual(output, expected)
      assert.deepStrictEqual(requests, [undefined, 'foo', 'bar', 'baz'])
    })

    it('can collapse the root value', () => {
      const input = {
        foo: 'bar',
        baz: 123
      }

      const expected = '{"foo": "bar", "baz": 123}\n'

      const requests: unknown[] = []

      const output = serialize(input, {
        shouldCollapse: (key, value) => {
          requests.push(key)
          return true
        }
      })

      assert.strictEqual(output, expected)
      assert.deepStrictEqual(requests, [undefined])
    })
  })

  describe('deserialize', () => {
    it('deserializes primitive values', () => {
      assert.strictEqual(deserialize('123'), 123)
      assert.strictEqual(deserialize('"foo"'), 'foo')
      assert.strictEqual(deserialize('true'), true)
      assert.strictEqual(deserialize('null'), null)
    })

    it('deserializes objects', () => {
      const input = [
        '{',
        '  "foo": "bar",',
        '  "baz": 123,',
        '  "qux": true,',
        '  "nested": {',
        '    "a": 1,',
        '    "b": 2',
        '  }',
        '}'
      ].join('\n')

      const expected = {
        foo: 'bar',
        baz: 123,
        qux: true,
        nested: {
          a: 1,
          b: 2
        }
      }

      const output = deserialize(input)

      assert.deepStrictEqual(output, expected)
    })

    it('deserializes arrays', () => {
      const input = [
        '[',
        '  1,',
        '  2,',
        '  3,',
        '  "foo",',
        '  true,',
        '  null',
        ']'
      ].join('\n')

      const expected = [1, 2, 3, 'foo', true, null]

      const output = deserialize(input)

      assert.deepStrictEqual(output, expected)
    })

    it('deserializes Map and Set objects', () => {
      const input = [
        '{',
        '  "map": {',
        '    "%Map%": [',
        '      [',
        '        "foo",',
        '        "bar"',
        '      ],',
        '      [',
        '        "baz",',
        '        123',
        '      ]',
        '    ]',
        '  },',
        '  "set": {',
        '    "%Set%": [',
        '      1,',
        '      2,',
        '      3',
        '    ]',
        '  }',
        '}'
      ].join('\n')

      const expected = {
        map: new Map<any, any>([
          ['foo', 'bar'],
          ['baz', 123]
        ]),
        set: new Set([1, 2, 3])
      }

      const output = deserialize(input)

      assert.deepStrictEqual(output, expected)
    })
  })
})
