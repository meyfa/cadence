import type { BusId, InstrumentId, Mixer, MixerRouting, MixerSource, Program, Track } from '@meyfa/cadence-core'
import { setAll } from '@meyfa/cadence-utility'
import { MixerFacet } from '../../type-system/domain/mixer.ts'
import { TrackFacet } from '../../type-system/domain/track.ts'
import type { Value } from '../../type-system/types.ts'
import { assert, assertNever, fail } from '../assert.ts'
import { globalBuiltins } from '../builtins/global.ts'
import type { CheckedProgram } from '../checker/index.ts'
import { processImports } from './imports.ts'
import type { GenerateOptions } from './options.ts'
import type { Scope } from './scopes.ts'
import { createGlobalScope, createLocalScope } from './scopes.ts'
import { processStatement } from './statements.ts'

/**
 * Generate a runnable program from an AST. This assumes the AST has already been
 * semantically checked and is valid.
 */
export function generate (program: CheckedProgram, options: GenerateOptions): Program {
  const initialResolutions = new Map<string, Value>()
  setAll(initialResolutions, processImports(program.ast.imports))
  setAll(initialResolutions, globalBuiltins)

  const top = createGlobalScope(options, program.semantic, initialResolutions)
  const scope = createLocalScope(top)

  let mixer: Mixer | undefined
  let track: Track | undefined

  for (const child of program.ast.children) {
    const { emissions } = processStatement(scope, child)

    for (const emission of emissions) {
      if (MixerFacet.has(emission)) {
        assert(mixer == null)
        mixer = MixerFacet.get(emission)
      } else if (TrackFacet.has(emission)) {
        assert(track == null)
        track = TrackFacet.get(emission)
      } else {
        fail()
      }
    }
  }

  mixer ??= { buses: [], routings: [] }
  track ??= { tempo: options.tempo.default, parts: [] }

  // Implicit output routings for unrouted buses and instruments
  mixer = {
    ...mixer,
    routings: [...mixer.routings, ...generateImplicitRoutings(scope, mixer)]
  }

  return {
    beatsPerBar: options.beatsPerBar,

    instruments: top.instruments,
    automations: top.automations,
    assets: top.assets,

    track,
    mixer
  }
}

function generateImplicitRoutings (scope: Scope, mixer: Mixer): readonly MixerRouting[] {
  const routings: MixerRouting[] = []

  const unroutedBuses = new Set<BusId>(mixer.buses.map((b) => b.id))
  const unroutedInstruments = new Set<InstrumentId>(scope.top.instruments.keys())

  for (const routing of mixer.routings) {
    switch (routing.source.type) {
      case 'bus':
        unroutedBuses.delete(routing.source.id)
        break
      case 'instrument':
        unroutedInstruments.delete(routing.source.id)
        break
      default:
        assertNever(routing.source)
    }
  }

  const createImplicitRouting = (source: MixerSource) => {
    routings.push({ implicit: true, source, destination: { type: 'output' } })
  }

  for (const busId of unroutedBuses) {
    createImplicitRouting({ type: 'bus', id: busId })
  }

  for (const instrumentId of unroutedInstruments) {
    createImplicitRouting({ type: 'instrument', id: instrumentId })
  }

  return routings
}
