import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { analyzeSourceWithParser } from '../../src/analysis/model.js'
import { findIdentifierAt } from '../../src/analysis/query.js'

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

  it('builds a sorted list of identifiers', () => {
    const source = [
      'use "instruments" as *',
      'use "patterns" as p',
      '',
      'base_path = "/samples"',
      'kick = sample("{base_path}/kick.wav")',
      'tempo = 120.bpm',
      '',
      'track (tempo: tempo) {',
      '  part intro (4.bars) {',
      '    kick << p.loop([x---])',
      '    automate kick.gain as curve [hold(-60.db)]',
      '  }',
      '}',
      '',
      'mixer {',
      '  bus drums {',
      '    kick snare',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    assert.deepStrictEqual(
      model.identifiers.map(({ kind, scopeId, name }) => ({
        kind,
        scope: model.scopes.get(scopeId)?.kind,
        name
      })),
      [
        { kind: 'UseAlias', scope: 'root', name: 'p' },
        { kind: 'VariableDefinition', scope: 'root', name: 'base_path' },
        { kind: 'VariableDefinition', scope: 'root', name: 'kick' },
        { kind: 'Callee', scope: 'root', name: 'sample' },
        { kind: 'VariableName', scope: 'root', name: 'base_path' },
        { kind: 'VariableDefinition', scope: 'root', name: 'tempo' },
        { kind: 'PropertyName', scope: 'track', name: 'tempo' },
        { kind: 'VariableName', scope: 'track', name: 'tempo' },
        { kind: 'VariableDefinition', scope: 'track', name: 'intro' },
        { kind: 'VariableName', scope: 'track', name: 'kick' },
        { kind: 'VariableName', scope: 'track', name: 'p' },
        { kind: 'Callee', scope: 'track', name: 'loop' },
        { kind: 'VariableName', scope: 'track', name: 'kick' },
        { kind: 'MemberAccess', scope: 'track', name: 'gain' },
        { kind: 'VariableDefinition', scope: 'mixer', name: 'drums' },
        { kind: 'VariableName', scope: 'mixer', name: 'kick' },
        { kind: 'VariableName', scope: 'mixer', name: 'snare' }
      ]
    )
  })

  it('includes identifiers not part of valid syntax', () => {
    const source = [
      'sample',
      'track {',
      '  part intro {',
      '    kick',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    assert.deepStrictEqual(
      model.identifiers.map((identifier) => ({ kind: identifier.kind, name: identifier.name })),
      [
        { kind: 'VariableName', name: 'sample' },
        { kind: 'VariableDefinition', name: 'intro' },
        { kind: 'VariableName', name: 'kick' }
      ]
    )
  })

  it('includes member expressions not part of valid syntax', () => {
    const source = [
      'fx.delay',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    assert.deepStrictEqual(
      model.identifiers.map((identifier) => ({ kind: identifier.kind, name: identifier.name })),
      [
        { kind: 'VariableName', name: 'fx' },
        { kind: 'MemberAccess', name: 'delay' }
      ]
    )
  })

  it('includes call expressions not part of valid syntax', () => {
    const source = [
      'delay(0.5.beats)',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    assert.deepStrictEqual(
      model.identifiers.map((identifier) => ({ kind: identifier.kind, name: identifier.name })),
      [
        // should be Callee, but this is a known limitation of the model when parsing incomplete code
        { kind: 'VariableName', name: 'delay' }
      ]
    )
  })

  it('includes identifiers that are part of an incomplete statement', () => {
    const source = [
      'part main {',
      '  foo = 42',
      '  foo',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    assert.deepStrictEqual(
      model.identifiers.map((identifier) => ({ kind: identifier.kind, name: identifier.name })),
      [
        { kind: 'VariableName', name: 'main' },
        { kind: 'VariableDefinition', name: 'foo' },
        { kind: 'VariableName', name: 'foo' }
      ]
    )
  })

  it('sets previous sibling for member accesses', () => {
    const source = [
      'foo = a.b',
      'bar = d.e.f',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    const b = model.identifiers.find((identifier) => identifier.name === 'b')
    const a = model.identifiers.find((identifier) => identifier.name === 'a')
    assert.ok(b != null, 'expected to find b')
    assert.ok(a != null, 'expected to find a')
    assert.strictEqual(b.previousSibling, a)

    const f = model.identifiers.find((identifier) => identifier.name === 'f')
    const e = model.identifiers.find((identifier) => identifier.name === 'e')
    const d = model.identifiers.find((identifier) => identifier.name === 'd')
    assert.ok(f != null, 'expected to find f')
    assert.ok(e != null, 'expected to find e')
    assert.ok(d != null, 'expected to find d')
    assert.strictEqual(f.previousSibling, e)
    assert.strictEqual(e.previousSibling, d)
  })

  it('does not set previous sibling for call arguments', () => {
    const source = [
      'use "effects" as fx',
      'delay = 1',
      'mixer {',
      '  bus main {',
      '    effect fx.delay(time: delay)',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    const timeProperty = findIdentifierAt(model, source.indexOf('time:'))
    assert.strictEqual(timeProperty?.kind, 'PropertyName')
    assert.strictEqual(timeProperty.previousSibling, undefined)

    const delayArgument = findIdentifierAt(model, source.indexOf('delay)') + 1)
    assert.strictEqual(delayArgument?.kind, 'VariableName')
    assert.strictEqual(delayArgument.previousSibling, undefined)
  })

  it('resolves known values for identifiers', () => {
    const source = [
      'use "instruments" as *',
      'use "patterns" as p',
      '',
      'kick = sample("/samples/kick.wav")',
      'snare = sample("/samples/snare.wav")',
      '',
      'track {',
      '  part intro {',
      '    kick << p.loop([x---])',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    const aliasIdentifier = findIdentifierAt(model, source.indexOf('as p') + 'as '.length)
    assert.strictEqual(aliasIdentifier?.name, 'p')
    assert.deepStrictEqual(model.knownValues.get(aliasIdentifier), {
      moduleName: 'patterns'
    })

    const sampleIdentifier = findIdentifierAt(model, source.indexOf('sample("/samples/kick.wav")'))
    assert.strictEqual(sampleIdentifier?.name, 'sample')
    assert.deepStrictEqual(model.knownValues.get(sampleIdentifier), {
      moduleName: 'instruments',
      exportName: 'sample'
    })

    const pIdentifier = findIdentifierAt(model, source.indexOf('p.loop'))
    assert.strictEqual(pIdentifier?.name, 'p')
    assert.deepStrictEqual(model.knownValues.get(pIdentifier), {
      moduleName: 'patterns'
    })

    const loopIdentifier = findIdentifierAt(model, source.indexOf('loop([x---])'))
    assert.strictEqual(loopIdentifier?.name, 'loop')
    assert.deepStrictEqual(model.knownValues.get(loopIdentifier), {
      moduleName: 'patterns',
      exportName: 'loop'
    })
  })

  it('does not set known values for property names', () => {
    const source = [
      'use "effects" as *',
      '',
      'mixer {',
      '  bus main (gain: -3.db) {}',
      '}',
      ''
    ].join('\n')

    const model = analyzeSourceWithParser(cadenceParser, source)

    const gainProperty = findIdentifierAt(model, source.indexOf('gain:'))
    assert.strictEqual(gainProperty?.kind, 'PropertyName')
    assert.strictEqual(model.knownValues.get(gainProperty), undefined)
  })
})
