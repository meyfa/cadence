import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeBaseModel } from '../../../src/model/analysis/base.js'
import type { BaseModel } from '../../../src/model/model.js'
import { textFromString } from '../../../src/utilities/text.js'
import { getCadenceParser, getRangeAt } from '../../helpers.js'

const cadenceParser = await getCadenceParser()

function analyzeSource (source: string): BaseModel {
  const tree = cadenceParser.parse(source)
  const document = textFromString(source)

  return computeBaseModel(tree, document)
}

describe('model/analysis/base.ts', () => {
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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

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

    const model = analyzeSource(source)

    // "time" (of "time: delay"), as well as "delay" (the argument) should not have a previous sibling.

    const time = model.identifiers.find((item) => item.name === 'time' && item.range.offset === source.indexOf('time:'))
    assert.ok(time != null, 'expected to find time')
    assert.strictEqual(time.previousSibling, undefined)

    const delay = model.identifiers.find((item) => item.name === 'delay' && item.range.offset === source.indexOf('delay)'))
    assert.ok(delay != null, 'expected to find delay')
    assert.strictEqual(delay.previousSibling, undefined)
  })

  it('includes bindings for definitions', () => {
    const source = [
      'kick = sample("/samples/kick.wav")',
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
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.bindings.map((binding) => ({ kind: binding.kind, name: binding.name, range: binding.range })),
      [
        {
          kind: 'assignment',
          name: 'kick',
          range: getRangeAt(source, source.indexOf('kick ='), 'kick'.length)
        },
        {
          kind: 'part',
          name: 'intro',
          range: getRangeAt(source, source.indexOf('intro (4.bars)'), 'intro'.length)
        },
        {
          kind: 'bus',
          name: 'drums',
          range: getRangeAt(source, source.indexOf('bus drums') + 'bus '.length, 'drums'.length)
        }
      ]
    )
  })

  it('includes bindings for alias imports', () => {
    const source = [
      'use "effects" as fx',
      'use "patterns" as *',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.bindings.map((binding) => ({ kind: binding.kind, name: binding.name, range: binding.range })),
      [
        {
          kind: 'use-alias',
          name: 'fx',
          range: getRangeAt(source, source.indexOf('as fx') + 'as '.length, 'fx'.length)
        }
      ]
    )
  })
})
