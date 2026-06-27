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
  it('builds a sorted list of identifiers', () => {
    const source = [
      'use "instruments" as *',
      'use "effects" as fx',
      '',
      'base_path = "/samples"',
      'kick = sample("{base_path}/kick.wav")',
      'tempo = 120.bpm',
      '',
      'synth = instrument {',
      '  voice note {}',
      '}',
      '',
      'track (tempo: tempo) {',
      '  part intro (4.bars) {',
      '    kick << [x---].loop()',
      '    automate kick.gain as ~[hold(-60.db)]',
      '  }',
      '}',
      '',
      'mixer {',
      '  bus drums {',
      '    effect crush = fx.clip(-6.db)',
      '    kick snare',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.identifiers.map(({ kind, scopeId, name }) => ({
        kind,
        scope: model.scopes.find((scope) => scope.id === scopeId)?.kind,
        name
      })),
      [
        { kind: 'definition', scope: 'root', name: 'fx' },
        { kind: 'definition', scope: 'root', name: 'base_path' },
        { kind: 'definition', scope: 'root', name: 'kick' },
        { kind: 'plain', scope: 'root', name: 'sample' },
        { kind: 'plain', scope: 'root', name: 'base_path' },
        { kind: 'definition', scope: 'root', name: 'tempo' },
        { kind: 'plain', scope: 'root', name: 'bpm' },
        { kind: 'definition', scope: 'root', name: 'synth' },
        { kind: 'definition', scope: 'voice', name: 'note' },
        { kind: 'property-name', scope: 'root', name: 'tempo' },
        { kind: 'plain', scope: 'root', name: 'tempo' },
        { kind: 'definition', scope: 'track', name: 'intro' },
        { kind: 'plain', scope: 'track', name: 'bars' },
        { kind: 'plain', scope: 'part', name: 'kick' },
        { kind: 'plain', scope: 'part', name: 'loop' },
        { kind: 'plain', scope: 'part', name: 'kick' },
        { kind: 'plain', scope: 'part', name: 'gain' },
        { kind: 'plain', scope: 'part', name: 'db' },
        { kind: 'definition', scope: 'mixer', name: 'drums' },
        { kind: 'definition', scope: 'bus', name: 'crush' },
        { kind: 'plain', scope: 'bus', name: 'fx' },
        { kind: 'plain', scope: 'bus', name: 'clip' },
        { kind: 'plain', scope: 'bus', name: 'db' },
        { kind: 'plain', scope: 'bus', name: 'kick' },
        { kind: 'plain', scope: 'bus', name: 'snare' }
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
        { kind: 'plain', name: 'sample' },
        { kind: 'definition', name: 'intro' },
        { kind: 'plain', name: 'kick' }
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
        { kind: 'plain', name: 'fx' },
        { kind: 'plain', name: 'delay' }
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
        { kind: 'plain', name: 'delay' },
        { kind: 'plain', name: 'beats' }
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
        { kind: 'plain', name: 'main' },
        { kind: 'definition', name: 'foo' },
        { kind: 'plain', name: 'foo' }
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

  it('builds scopes and bindings for valid programs', () => {
    const source = [
      'use "effects" as fx',
      'kick = sample("/samples/kick.wav")',
      'snare = sample("/samples/snare.wav", gain: -3.db)',
      '',
      'my_instrument = instrument {',
      '  foo = 42',
      '  bar = foo * 2',
      '  voice note {',
      '    baz = bar + 1',
      '  } // end voice',
      '} // end instrument',
      '',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    kick << [x---]',
      '  } // end part',
      '} // end track',
      '',
      'mixer {',
      '  bus drums (gain: -1.5.db) {',
      '    kick snare',
      '  }',
      '  bus delay {',
      '    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '  }',
      '} // end mixer',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const rootRange = getRangeAt(source, 0, source.length)
    const rootScopeId = `root:${rootRange.offset}:${rootRange.length}`

    const instrumentBlockStart = source.indexOf('{', source.indexOf('my_instrument'))
    const instrumentBlockEnd = source.indexOf('} // end instrument') + '}'.length
    const instrumentRange = getRangeAt(source, instrumentBlockStart, instrumentBlockEnd - instrumentBlockStart)
    const instrumentScopeId = `instrument:${instrumentRange.offset}:${instrumentRange.length}`

    const voiceBlockStart = source.indexOf('voice note')
    const voiceBlockEnd = source.indexOf('} // end voice') + '}'.length
    const voiceRange = getRangeAt(source, voiceBlockStart, voiceBlockEnd - voiceBlockStart)
    const voiceScopeId = `voice:${voiceRange.offset}:${voiceRange.length}`

    const trackBlockStart = source.indexOf('{', source.indexOf('track'))
    const trackEnd = source.indexOf('} // end track') + '}'.length
    const trackRange = getRangeAt(source, trackBlockStart, trackEnd - trackBlockStart)
    const trackScopeId = `track:${trackRange.offset}:${trackRange.length}`

    const partBlockStart = source.indexOf('{', source.indexOf('part intro'))
    const partEnd = source.indexOf('} // end part') + '}'.length
    const partRange = getRangeAt(source, partBlockStart, partEnd - partBlockStart)
    const partScopeId = `part:${partRange.offset}:${partRange.length}`

    const mixerBlockStart = source.indexOf('{', source.indexOf('mixer'))
    const mixerEnd = source.indexOf('} // end mixer') + '}'.length
    const mixerRange = getRangeAt(source, mixerBlockStart, mixerEnd - mixerBlockStart)
    const mixerScopeId = `mixer:${mixerRange.offset}:${mixerRange.length}`

    const drumsBusBlockStart = source.indexOf('{', source.indexOf('bus drums'))
    const drumsBusEnd = source.indexOf('  }', source.indexOf('bus drums')) + '  }'.length
    const drumsBusRange = getRangeAt(source, drumsBusBlockStart, drumsBusEnd - drumsBusBlockStart)
    const drumsBusScopeId = `bus:${drumsBusRange.offset}:${drumsBusRange.length}`

    const delayBusBlockStart = source.indexOf('{', source.indexOf('bus delay'))
    const delayBusEnd = source.indexOf('  }', source.indexOf('bus delay')) + '  }'.length
    const delayBusRange = getRangeAt(source, delayBusBlockStart, delayBusEnd - delayBusBlockStart)
    const delayBusScopeId = `bus:${delayBusRange.offset}:${delayBusRange.length}`

    assert.deepStrictEqual(
      model.scopes.map(({ id, kind, parentId }) => ({ id, kind, parentId })),
      [
        { id: rootScopeId, kind: 'root', parentId: undefined },
        { id: instrumentScopeId, kind: 'instrument', parentId: rootScopeId },
        { id: voiceScopeId, kind: 'voice', parentId: instrumentScopeId },
        { id: trackScopeId, kind: 'track', parentId: rootScopeId },
        { id: partScopeId, kind: 'part', parentId: trackScopeId },
        { id: mixerScopeId, kind: 'mixer', parentId: rootScopeId },
        { id: drumsBusScopeId, kind: 'bus', parentId: mixerScopeId },
        { id: delayBusScopeId, kind: 'bus', parentId: mixerScopeId }
      ]
    )

    assert.deepStrictEqual(
      model.bindings.map(({ kind, name, declaredScopeId }) => ({ kind, name, declaredScopeId })),
      [
        { kind: 'use-alias', name: 'fx', declaredScopeId: undefined },
        { kind: 'regular', name: 'kick', declaredScopeId: undefined },
        { kind: 'regular', name: 'snare', declaredScopeId: undefined },
        { kind: 'regular', name: 'my_instrument', declaredScopeId: undefined },
        { kind: 'regular', name: 'foo', declaredScopeId: undefined },
        { kind: 'regular', name: 'bar', declaredScopeId: undefined },
        { kind: 'regular', name: 'note', declaredScopeId: undefined },
        { kind: 'regular', name: 'baz', declaredScopeId: undefined },
        { kind: 'part', name: 'intro', declaredScopeId: undefined },
        { kind: 'bus', name: 'drums', declaredScopeId: drumsBusScopeId },
        { kind: 'bus', name: 'delay', declaredScopeId: delayBusScopeId }
      ]
    )
  })

  it('includes bindings for definitions', () => {
    const source = [
      'kick = sample("/samples/kick.wav")',
      '',
      'synth = instrument {',
      '  foo = 42',
      '  voice note {',
      '    bar = 440.hz',
      '  }',
      '}',
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
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.bindings.map((binding) => ({ kind: binding.kind, name: binding.name, range: binding.range })),
      [
        {
          kind: 'regular',
          name: 'kick',
          range: getRangeAt(source, source.indexOf('kick ='), 'kick'.length)
        },
        {
          kind: 'regular',
          name: 'synth',
          range: getRangeAt(source, source.indexOf('synth ='), 'synth'.length)
        },
        {
          kind: 'regular',
          name: 'foo',
          range: getRangeAt(source, source.indexOf('foo ='), 'foo'.length)
        },
        {
          kind: 'regular',
          name: 'note',
          range: getRangeAt(source, source.indexOf('note'), 'note'.length)
        },
        {
          kind: 'regular',
          name: 'bar',
          range: getRangeAt(source, source.indexOf('bar ='), 'bar'.length)
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
      'use "instruments" as *',
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

  it('includes list of imports', () => {
    const source = [
      'use "effects" as fx',
      'use "instruments" as *',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.imports.map(({ moduleName, range, alias, aliasRange }) => ({ moduleName, range, alias, aliasRange })),
      [
        {
          moduleName: 'effects',
          range: getRangeAt(source, source.indexOf('use "effects" as fx'), 'use "effects" as fx'.length),
          alias: 'fx',
          aliasRange: getRangeAt(source, source.indexOf('as fx') + 'as '.length, 'fx'.length)
        },
        {
          moduleName: 'instruments',
          range: getRangeAt(source, source.indexOf('use "instruments" as *'), 'use "instruments" as *'.length),
          alias: undefined,
          aliasRange: getRangeAt(source, source.indexOf('as *') + 'as '.length, '*'.length)
        }
      ]
    )
  })

  it('parses import module names with language string escapes', () => {
    // Note: JSON.parse() would throw on '\\{'.
    const source = [
      'use "effects\\{main\\}" as fx',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.imports.map(({ moduleName, alias }) => ({ moduleName, alias })),
      [
        {
          moduleName: 'effects{main}',
          alias: 'fx'
        }
      ]
    )
  })
})
