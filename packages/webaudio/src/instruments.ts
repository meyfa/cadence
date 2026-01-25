import type { Instrument, InstrumentId, Program } from '@core/program.js'
import { createDeferred } from '@core/utilities/deferred.js'
import { Sampler } from 'tone'
import { DEFAULT_ROOT_NOTE } from './constants.js'
import type { InstrumentInstance } from './instances.js'

export function createInstruments (program: Program): ReadonlyMap<InstrumentId, InstrumentInstance> {
  return new Map(
    [...program.instruments.values()].map((instrument) => [
      instrument.id,
      createInstrument(instrument)
    ])
  )
}

function createInstrument (instrument: Instrument): InstrumentInstance {
  const deferred = createDeferred()

  const node = new Sampler({
    onload: () => deferred.resolve(),
    onerror: (error) => deferred.reject(error),
    urls: {
      [instrument.rootNote ?? DEFAULT_ROOT_NOTE]: instrument.sampleUrl
    },
    volume: instrument.gain.initial.value,
    // declick
    attack: 0.005,
    release: 0.005
  })

  return {
    output: node,

    loaded: deferred.promise.then(() => undefined),

    dispose: () => {
      node.releaseAll().dispose()
    },

    triggerAttack: (...args) => {
      // prevent an exception by checking if loaded
      if (node.loaded) {
        node.triggerAttack(...args)
      }
    },

    triggerRelease: (...args) => {
      if (node.loaded) {
        node.triggerRelease(...args)
      }
    }
  }
}
