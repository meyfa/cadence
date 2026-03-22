import type { Result } from '@language'
import { compile, lex, parse } from '@language'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { demoCode } from '../src/demo.js'

function getResultError<TValue, TError> (result: Result<TValue, TError>): TError | undefined {
  if (result.complete) {
    return undefined
  }
  return result.error
}

describe('demo.ts', () => {
  it('should compile without errors', () => {
    const lexResult = lex(demoCode)
    assert.strictEqual(lexResult.complete, true, getResultError(lexResult))

    const parseResult = parse(lexResult.value)
    assert.strictEqual(parseResult.complete, true, getResultError(parseResult))

    const compileResult = compile(parseResult.value, {
      tempo: {
        default: 120,
        minimum: 1,
        maximum: 400
      },
      beatsPerBar: 4
    })
    assert.strictEqual(compileResult.complete, true, getResultError(compileResult))
  })
})
