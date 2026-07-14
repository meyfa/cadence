import type { Result } from '@meyfa/cadence-language'
import { check, generate, lex, parse } from '@meyfa/cadence-language'
import type { Numeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { demoCode } from '../../src/defaults/demo-code.js'

function getResultError<TValue, TError> (result: Result<TValue, TError>): TError | undefined {
  if (result.complete) {
    return undefined
  }
  return result.error
}

describe('defaults/demo-code.ts', () => {
  it('should compile without errors', () => {
    const lexResult = lex(demoCode)
    assert.strictEqual(lexResult.complete, true, getResultError(lexResult))

    const parseResult = parse(lexResult.value)
    assert.strictEqual(parseResult.complete, true, getResultError(parseResult))

    const checkResult = check(parseResult.value)
    assert.strictEqual(checkResult.complete, true, getResultError(checkResult))

    const program = generate(checkResult.value, {
      tempo: {
        default: 120 as Numeric<'bpm'>,
        minimum: 1 as Numeric<'bpm'>,
        maximum: 400 as Numeric<'bpm'>
      },
      beatsPerBar: 4
    })

    assert.ok(program.track.parts.length > 0, 'Expected at least one part to be generated')
    assert.ok(program.mixer.buses.length > 0, 'Expected at least one mixer bus to be generated')
    assert.ok(program.instruments.size > 0, 'Expected at least one instrument to be generated')
  })
})
