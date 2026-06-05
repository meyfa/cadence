import { describe, it } from 'node:test'
import { Modules } from '../../src/compiler/type-helpers.js'
import { StringFacet } from '../../src/type-system/base/string.js'
import { ModuleFacet } from '../../src/type-system/base/module.js'
import assert from 'node:assert'
import { RecordFacet } from '../../src/type-system/base/record.js'

describe('compiler/type-helpers.ts', () => {
  describe('Modules', () => {
    it('should not pollute the prototype with modules that export __proto__', () => {
      const protoValue = StringFacet.type().of('malicious')

      const module = Modules.of({
        name: 'foobar',
        exports: new Map([
          ['__proto__', protoValue]
        ])
      })

      const moduleData = ModuleFacet.get(module)
      assert.strictEqual(moduleData.name, 'foobar')
      assert.strictEqual(moduleData.exports.get('__proto__'), protoValue)

      const recordData = RecordFacet.get(module)
      assert.strictEqual(Object.getPrototypeOf(recordData), null)
      assert.strictEqual(recordData.__proto__, protoValue)
    })
  })
})
