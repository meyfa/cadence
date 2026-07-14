import assert from 'node:assert'
import { describe, it } from 'node:test'
import { getHoverInfo } from '../../src/hover/operation.ts'
import { applySemanticOperationWithParser } from '../../src/utilities/operations.ts'
import { getCadenceParser, getRangeAt } from '../helpers.ts'

const cadenceParser = await getCadenceParser()

describe('hover/operation.ts', () => {
  it('returns function docs for wildcard-imported symbols', () => {
    const source = [
      'use "effects" as *',
      'mixer {',
      '  bus drum_bus {',
      '    effect gain(-6.db)',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('gain(') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      {
        range: getRangeAt(source, source.indexOf('gain('), 'gain'.length),
        title: 'gain(gain: number(db)) -> effect + record(gain)',
        summary: 'Applies a gain adjustment to the signal.',
        annotations: ['may block']
      }
    )
  })

  it('returns module docs for aliased imports', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus drum_bus {',
      '    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('fx.delay') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      {
        range: getRangeAt(source, source.indexOf('fx.delay'), 'fx'.length),
        title: 'module effects',
        summary: 'Effect functions for shaping mixer bus audio.'
      }
    )
  })

  it('returns function docs for aliased module members', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus drum_bus {',
      '    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '    effect fx.reverb(mix: 0.3, decay: 1.s)',
      '  }',
      '}',
      ''
    ].join('\n')

    const delayPosition = source.indexOf('fx.delay') + 'fx.'.length + 1
    const reverbPosition = source.indexOf('fx.reverb') + 'fx.'.length + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, delayPosition),
      {
        range: getRangeAt(source, source.indexOf('delay('), 'delay'.length),
        title: 'delay(mix: number, time: number(beats) | number(s), feedback: number, wet?: number(db)) -> effect + record(feedback)',
        summary: 'Adds echoes with configurable mix, time, and feedback.',
        annotations: ['may block']
      }
    )

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, reverbPosition),
      {
        range: getRangeAt(source, source.indexOf('reverb('), 'reverb'.length),
        title: 'reverb(mix: number, decay: number(beats) | number(s), wet?: number(db)) -> effect',
        summary: 'Adds reverberation with configurable mix and decay.',
        annotations: ['may block']
      }
    )
  })

  it('does not return docs for property names that only textually match wildcard imports', () => {
    const source = [
      'use "effects" as *',
      'mixer {',
      '  bus drum_bus {',
      '    effect delay(gain: 0.5)',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('gain:') + 1

    assert.strictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      undefined
    )
  })

  it('uses correct boundary for identifier lookup', () => {
    const source = [
      'use "instruments" as *',
      'foo = sample("...")',
      ''
    ].join('\n')

    const beforeNamePosition = source.indexOf(' sample')
    const startOfNamePosition = source.indexOf('sample')
    const endOfNamePosition = source.indexOf('sample') + 'sample'.length
    const afterNamePosition = source.indexOf('sample') + 'sample'.length + 1

    const beforeName = applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, beforeNamePosition)
    const startOfName = applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, startOfNamePosition)
    const endOfName = applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, endOfNamePosition)
    const afterName = applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, afterNamePosition)

    assert.ok(beforeName == null, 'before name')
    assert.ok(startOfName != null, 'start of name')
    assert.ok(endOfName != null, 'end of name')
    assert.ok(afterName == null, 'after name')
  })

  it('returns docs for identifiers not part of valid syntax', () => {
    // member accesses cannot be standalone expressions, but should still show hover info
    const source = [
      'use "effects" as fx',
      'fx.delay',
      ''
    ].join('\n')

    const modulePosition = source.indexOf('fx.delay') + 1
    const moduleDocs = applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, modulePosition)

    assert.strictEqual(moduleDocs?.title, 'module effects')

    const memberPosition = source.indexOf('delay') + 1
    const memberDocs = applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, memberPosition)

    assert.strictEqual(memberDocs?.title.slice(0, 'delay'.length), 'delay')
  })

  it('does not treat call arguments as aliased module members', () => {
    const source = [
      'use "effects" as fx',
      'delay = 1',
      'mixer {',
      '  bus main {',
      '    effect fx.reverb(delay)',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.lastIndexOf('delay)') + 1

    assert.strictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      undefined
    )
  })

  it('does not return docs for non-default imports', () => {
    const source = [
      'use "effects" as fx',
      'foo = delay',
      ''
    ].join('\n')

    const position = source.indexOf('delay') + 1

    assert.strictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      undefined
    )
  })
})
