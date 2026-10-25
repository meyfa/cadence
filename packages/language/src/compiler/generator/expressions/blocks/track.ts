import { ast } from '@meyfa/cadence-ast'
import type { Automation, Part } from '@meyfa/cadence-core'
import { beatsToSeconds } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { setAll } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { PartFacet } from '../../../../type-system/domain/part.ts'
import { TrackFacet } from '../../../../type-system/domain/track.ts'
import { makeFacetType } from '../../../../type-system/factory.ts'
import type { Value } from '../../../../type-system/types.ts'
import { nonNull } from '../../../assert.ts'
import { trackSchema } from '../../../common.ts'
import type { RenderCurveOptions } from '../../../curves.ts'
import { mergeCurvePoints, renderCurvePoints } from '../../../curves.ts'
import { RecordBuilder } from '../../properties.ts'
import type { GlobalScope, Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'
import { resolveArgumentList } from '../arguments.ts'
import { clamped } from '../utilities.ts'

export function generateTrack (scope: Scope, expression: ast.Track): Value {
  const { options } = scope.top

  const args = resolveArgumentList(scope, expression.arguments, trackSchema)
  const tempo = args.tempo != null
    ? clamped(NumberFacet.get(args.tempo), options.tempo.minimum, options.tempo.maximum).value
    : options.tempo.default

  const trackScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const parts: Part[] = []

  let currentTime = 0 as Numeric<'beats'>

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(trackScope, child)

    for (const emission of emissions) {
      const part = PartFacet.get(emission)
      parts.push(part)

      const automationRenderOptions: RenderCurveOptions = {
        offset: beatsToSeconds(currentTime, tempo),
        limit: beatsToSeconds(part.length, tempo),
        tempo
      }

      for (const automation of part.automations) {
        applyAutomation(scope.top, automation, automationRenderOptions)
      }

      currentTime = currentTime + part.length as Numeric<'beats'>
    }

    setAll(recordBuilder, properties)
  }

  const track = { tempo, parts }

  return !recordBuilder.empty
    ? makeFacetType(TrackFacet, recordBuilder.facet).of(track, recordBuilder.record)
    : TrackFacet.type().of(track)
}

function applyAutomation (top: GlobalScope, automation: Automation, options: RenderCurveOptions): void {
  const { parameterId, curve } = automation

  const rendered = renderCurvePoints(curve, options)
  const existing = nonNull(top.automations.get(parameterId), 'Parameter allocated incorrectly')

  const points = mergeCurvePoints(existing.points, rendered)
  top.automations.set(parameterId, { ...existing, points })
}
