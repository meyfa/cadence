import assert from 'node:assert'
import { describe, it } from 'node:test'
import { ModuleFacet } from '../../src/type-system/base/module.ts'
import { RecordFacet } from '../../src/type-system/base/record.ts'
import { StringFacet } from '../../src/type-system/base/string.ts'
import { Modules } from '../../src/type-system/helpers.ts'

describe('type-system/helpers.ts', () => {
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
