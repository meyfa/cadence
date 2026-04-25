import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { analyzeSourceWithParser } from '../../src/analysis/model.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

describe('analysis/model.ts', () => {
  it('builds scopes and bindings for valid programs', () => {
    const source = [
      'use "effects" as fx',
      'kick = sample("/samples/kick.wav")',
      'snare = sample("/samples/snare.wav", gain: -3.db)',
      '',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    kick << [x---]',
      '  }',
      '}',
      '',
      'mixer {',
      '  bus drums (gain: -1.5.db) {',
      '    kick snare',
      '  }',
      '  bus delay {',
      '    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    assert.ok(model.scopes.has(model.rootScopeId))

    const trackScope = [...model.scopes.values()].find((scope) => scope.kind === 'track')
    const mixerScope = [...model.scopes.values()].find((scope) => scope.kind === 'mixer')

    assert.ok(trackScope)
    assert.ok(mixerScope)
    assert.strictEqual(trackScope.parentId, model.rootScopeId)
    assert.strictEqual(mixerScope.parentId, model.rootScopeId)

    assert.deepStrictEqual(
      model.bindings.map((binding) => ({ kind: binding.kind, name: binding.name })),
      [
        { kind: 'use-alias', name: 'fx' },
        { kind: 'assignment', name: 'kick' },
        { kind: 'assignment', name: 'snare' },
        { kind: 'part', name: 'intro' },
        { kind: 'bus', name: 'drums' },
        { kind: 'bus', name: 'delay' }
      ]
    )

    assert.deepStrictEqual(
      model.bindingsByName.get('kick')?.map((binding) => binding.kind),
      ['assignment']
    )

    assert.deepStrictEqual(
      model.bindingsByScope.get(trackScope.id)?.map((binding) => binding.name),
      ['intro']
    )

    assert.deepStrictEqual(
      model.bindingsByScope.get(mixerScope.id)?.map((binding) => binding.name),
      ['drums', 'delay']
    )
  })
})
