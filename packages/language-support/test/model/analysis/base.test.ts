import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeBaseModel } from '../../../src/model/analysis/base.ts'
import type { BaseModel } from '../../../src/model/model.ts'
import { textFromString } from '../../../src/utilities/text.ts'
import { getCadenceParser, getRangeAt } from '../../helpers.ts'

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
      'record = {',
      '  @record_property = 42',
      '}',
      '',
      'synth = instrument {',
      '  @instrument_property = 42',
      '  & voice note {}',
      '}',
      '',
      'double = (input: number.bpm) { & input * 2 }',
      '',
      '& track (tempo: double(64.bpm)) {',
      '  & part (4.bars) {',
      '    & play(kick, [x---].loop())',
      '    & automate(kick.gain, ~[hold(-60.db)])',
      '  }',
      '}',
      '',
      '& mixer {',
      '  & bus {',
      '    & @crush = fx.clip(-6.db)',
      '    & kick, snare',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.identifiers.map(({ kind, scopeId, name }) => ({
        kind,
        scope: model.scopes.find((scope) => scope.id === scopeId)?.node,
        name
      })),
      [
        { kind: 'definition', scope: 'Program', name: 'fx' },
        { kind: 'definition', scope: 'Program', name: 'base_path' },
        { kind: 'definition', scope: 'Program', name: 'kick' },
        { kind: 'plain', scope: 'Program', name: 'sample' },
        { kind: 'plain', scope: 'Program', name: 'base_path' },
        { kind: 'definition', scope: 'Program', name: 'tempo' },
        { kind: 'plain', scope: 'Program', name: 'bpm' },
        { kind: 'definition', scope: 'Program', name: 'record' },
        { kind: 'definition', scope: 'Record', name: 'record_property' },
        { kind: 'definition', scope: 'Program', name: 'synth' },
        { kind: 'definition', scope: 'InstrumentBlock', name: 'instrument_property' },
        { kind: 'definition', scope: 'Voice', name: 'note' },
        { kind: 'definition', scope: 'Program', name: 'double' },
        { kind: 'definition', scope: 'Function', name: 'input' },
        { kind: 'plain', scope: 'Function', name: 'input' },
        { kind: 'argument', scope: 'Program', name: 'tempo' },
        { kind: 'plain', scope: 'Program', name: 'double' },
        { kind: 'plain', scope: 'Program', name: 'bpm' },
        { kind: 'plain', scope: 'TrackBlock', name: 'bars' },
        { kind: 'plain', scope: 'PartBlock', name: 'play' },
        { kind: 'plain', scope: 'PartBlock', name: 'kick' },
        { kind: 'plain', scope: 'PartBlock', name: 'loop' },
        { kind: 'plain', scope: 'PartBlock', name: 'automate' },
        { kind: 'plain', scope: 'PartBlock', name: 'kick' },
        { kind: 'plain', scope: 'PartBlock', name: 'gain' },
        { kind: 'plain', scope: 'PartBlock', name: 'db' },
        { kind: 'definition', scope: 'BusBlock', name: 'crush' },
        { kind: 'plain', scope: 'BusBlock', name: 'fx' },
        { kind: 'plain', scope: 'BusBlock', name: 'clip' },
        { kind: 'plain', scope: 'BusBlock', name: 'db' },
        { kind: 'plain', scope: 'BusBlock', name: 'kick' },
        { kind: 'plain', scope: 'BusBlock', name: 'snare' }
      ]
    )
  })

  it('includes identifiers not part of valid syntax', () => {
    const source = [
      'sample',
      '& track {',
      '  & part {',
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
      'part {',
      '  foo = 42',
      '  foo',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    assert.deepStrictEqual(
      model.identifiers.map((identifier) => ({ kind: identifier.kind, name: identifier.name })),
      [
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
      '& mixer {',
      '  & bus {',
      '    & fx.delay(time: delay)',
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
      'my_function = (input: number.bpm) {',
      '  & input * 2',
      '} // end function',
      '',
      'my_record = {',
      '  @record_property = 42',
      '} // end record',
      '',
      'my_instrument = instrument {',
      '  @instrument_property = 42',
      '  foo = 42',
      '  bar = foo * 2',
      '  & voice note {',
      '    baz = bar + 1',
      '  } // end voice',
      '} // end instrument',
      '',
      '& track (120.bpm) {',
      '  & part (4.bars) {',
      '    & play(kick, [x---])',
      '  } // end part',
      '} // end track',
      '',
      '& mixer {',
      '  & drums = bus (gain: -1.5.db) {',
      '    & kick, snare',
      '  }',
      '  & @delay = bus {',
      '    & fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '  }',
      '} // end mixer',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const rootRange = getRangeAt(source, 0, source.length)
    const rootScopeId = `Program:${rootRange.offset}:${rootRange.length}`

    const functionBlockStart = source.indexOf('(input: number.bpm) {')
    const functionBlockEnd = source.indexOf('} // end function') + '}'.length
    const functionRange = getRangeAt(source, functionBlockStart, functionBlockEnd - functionBlockStart)
    const functionScopeId = `Function:${functionRange.offset}:${functionRange.length}`

    const recordBlockStart = source.indexOf('{', source.indexOf('my_record'))
    const recordBlockEnd = source.indexOf('} // end record') + '}'.length
    const recordRange = getRangeAt(source, recordBlockStart, recordBlockEnd - recordBlockStart)
    const recordScopeId = `Record:${recordRange.offset}:${recordRange.length}`

    const instrumentBlockStart = source.indexOf('{', source.indexOf('my_instrument'))
    const instrumentBlockEnd = source.indexOf('} // end instrument') + '}'.length
    const instrumentRange = getRangeAt(source, instrumentBlockStart, instrumentBlockEnd - instrumentBlockStart)
    const instrumentScopeId = `InstrumentBlock:${instrumentRange.offset}:${instrumentRange.length}`

    const voiceBlockStart = source.indexOf('voice note')
    const voiceBlockEnd = source.indexOf('} // end voice') + '}'.length
    const voiceRange = getRangeAt(source, voiceBlockStart, voiceBlockEnd - voiceBlockStart)
    const voiceScopeId = `Voice:${voiceRange.offset}:${voiceRange.length}`

    const trackBlockStart = source.indexOf('{', source.indexOf('track'))
    const trackEnd = source.indexOf('} // end track') + '}'.length
    const trackRange = getRangeAt(source, trackBlockStart, trackEnd - trackBlockStart)
    const trackScopeId = `TrackBlock:${trackRange.offset}:${trackRange.length}`

    const partBlockStart = source.indexOf('{', source.indexOf('& part'))
    const partEnd = source.indexOf('} // end part') + '}'.length
    const partRange = getRangeAt(source, partBlockStart, partEnd - partBlockStart)
    const partScopeId = `PartBlock:${partRange.offset}:${partRange.length}`

    const mixerBlockStart = source.indexOf('{', source.indexOf('mixer'))
    const mixerEnd = source.indexOf('} // end mixer') + '}'.length
    const mixerRange = getRangeAt(source, mixerBlockStart, mixerEnd - mixerBlockStart)
    const mixerScopeId = `MixerBlock:${mixerRange.offset}:${mixerRange.length}`

    const drumsBusBlockStart = source.indexOf('{', source.indexOf('& drums = '))
    const drumsBusEnd = source.indexOf('}', drumsBusBlockStart) + '}'.length
    const drumsBusRange = getRangeAt(source, drumsBusBlockStart, drumsBusEnd - drumsBusBlockStart)
    const drumsBusScopeId = `BusBlock:${drumsBusRange.offset}:${drumsBusRange.length}`

    const delayBusBlockStart = source.indexOf('{', source.indexOf('& @delay = '))
    const delayBusEnd = source.indexOf('}', delayBusBlockStart) + '}'.length
    const delayBusRange = getRangeAt(source, delayBusBlockStart, delayBusEnd - delayBusBlockStart)
    const delayBusScopeId = `BusBlock:${delayBusRange.offset}:${delayBusRange.length}`

    assert.deepStrictEqual(
      model.scopes.map(({ id, node, parentId }) => ({ id, node, parentId })),
      [
        { id: rootScopeId, node: 'Program', parentId: undefined },
        { id: functionScopeId, node: 'Function', parentId: rootScopeId },
        { id: recordScopeId, node: 'Record', parentId: rootScopeId },
        { id: instrumentScopeId, node: 'InstrumentBlock', parentId: rootScopeId },
        { id: voiceScopeId, node: 'Voice', parentId: instrumentScopeId },
        { id: trackScopeId, node: 'TrackBlock', parentId: rootScopeId },
        { id: partScopeId, node: 'PartBlock', parentId: trackScopeId },
        { id: mixerScopeId, node: 'MixerBlock', parentId: rootScopeId },
        { id: drumsBusScopeId, node: 'BusBlock', parentId: mixerScopeId },
        { id: delayBusScopeId, node: 'BusBlock', parentId: mixerScopeId }
      ]
    )

    assert.deepStrictEqual(
      model.bindings.map(({ kind, name, isExposed }) => ({ kind, name, isExposed })),
      [
        { kind: 'use-alias', name: 'fx', isExposed: undefined },
        { kind: 'regular', name: 'kick', isExposed: false },
        { kind: 'regular', name: 'snare', isExposed: false },
        { kind: 'regular', name: 'my_function', isExposed: false },
        { kind: 'regular', name: 'input', isExposed: undefined },
        { kind: 'regular', name: 'my_record', isExposed: false },
        { kind: 'regular', name: 'record_property', isExposed: true },
        { kind: 'regular', name: 'my_instrument', isExposed: false },
        { kind: 'regular', name: 'instrument_property', isExposed: true },
        { kind: 'regular', name: 'foo', isExposed: false },
        { kind: 'regular', name: 'bar', isExposed: false },
        { kind: 'regular', name: 'note', isExposed: undefined },
        { kind: 'regular', name: 'baz', isExposed: false },
        { kind: 'regular', name: 'drums', isExposed: false },
        { kind: 'regular', name: 'delay', isExposed: true }
      ]
    )
  })

  it('includes bindings for definitions', () => {
    const source = [
      'kick = sample("/samples/kick.wav")',
      '',
      'synth = instrument {',
      '  foo = 42',
      '  & voice note {',
      '    bar = 440.hz',
      '  }',
      '}',
      '',
      '& track (120.bpm) {',
      '  & @intro = part (4.bars) {',
      '    & play(kick, [x---])',
      '  }',
      '}',
      '',
      '& mixer {',
      '  & @drums = bus (gain: -1.5.db) {',
      '    & kick, snare',
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
          kind: 'regular',
          name: 'intro',
          range: getRangeAt(source, source.indexOf('@intro') + 1, 'intro'.length)
        },
        {
          kind: 'regular',
          name: 'drums',
          range: getRangeAt(source, source.indexOf('@drums') + 1, 'drums'.length)
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
