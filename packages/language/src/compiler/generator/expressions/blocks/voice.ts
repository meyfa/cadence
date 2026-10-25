import { ast } from '@meyfa/cadence-ast'
import type { NoteData, RelativeCurve, Source, Voice, VoiceInstance } from '@meyfa/cadence-core'
import { convertPitchToMidi, getMidiFrequency } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import { CurveFacet } from '../../../../type-system/domain/curve.ts'
import { SourceFacet } from '../../../../type-system/domain/source.ts'
import { VoiceFacet } from '../../../../type-system/domain/voice.ts'
import { Numbers } from '../../../../type-system/helpers.ts'
import type { Value } from '../../../../type-system/types.ts'
import { assert, fail } from '../../../assert.ts'
import type { NoteValue } from '../../../common.ts'
import { DEFAULT_ROOT_NOTE, noteType } from '../../../common.ts'
import { renderCurvePoints } from '../../../curves.ts'
import type { MutableScope, Scope } from '../../scopes.ts'
import { cloneScope, createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'

export function generateVoice (scope: Scope, expression: ast.Voice): Value {
  const frozenScope: Scope = cloneScope(scope)

  const invoke: Voice['invoke'] = (note, tempo) => {
    const instanceScope = createLocalScope(frozenScope)

    if (expression.bindings.note != null) {
      const noteBinding = createNoteBinding(note)

      assert(!instanceScope.resolutions.has(expression.bindings.note.name))
      instanceScope.resolutions.set(expression.bindings.note.name, noteBinding)
    }

    return createVoiceInstance(expression, instanceScope, tempo)
  }

  return VoiceFacet.type().of({ invoke })
}

const noteBindingCache = new WeakMap<NoteData, NoteValue>()

function createNoteBinding (note: NoteData): NoteValue {
  const cached = noteBindingCache.get(note)
  if (cached != null) {
    return cached
  }

  const gate = Numbers.of(runtimeNumeric('beats', note.gate ?? 0 as Numeric<'beats'>))
  const frequency = Numbers.of(
    runtimeNumeric('hz', getMidiFrequency(note.pitch != null ? convertPitchToMidi(note.pitch) : DEFAULT_ROOT_NOTE))
  )
  const velocity = Numbers.of(runtimeNumeric(undefined, note.velocity))

  const binding = noteType.of({ gate, frequency, velocity })
  noteBindingCache.set(note, binding)

  return binding
}

function createVoiceInstance (expression: ast.Voice, scope: MutableScope, tempo: Numeric<'bpm'>): VoiceInstance {
  let envelopeValue: RelativeCurve<'db'> | undefined
  let outputValue: Source | undefined

  for (const child of expression.children) {
    const { emissions } = processStatement(scope, child)

    for (const emission of emissions) {
      if (CurveFacet.with('db').has(emission)) {
        assert(envelopeValue == null)
        envelopeValue = CurveFacet.with('db').get(emission)
      } else if (SourceFacet.has(emission)) {
        assert(outputValue == null)
        outputValue = SourceFacet.get(emission)
      } else {
        fail()
      }
    }
  }

  assert(envelopeValue != null)
  assert(outputValue != null)

  const envelope = {
    initial: -Infinity as Numeric<'db'>,
    points: renderCurvePoints(envelopeValue, {
      offset: 0 as Numeric<'s'>,
      tempo
    })
  }

  return {
    envelope,
    source: outputValue,
    duration: envelope.points.at(-1)?.time
  }
}
