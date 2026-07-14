import type { AudioGraph, EntityKey, Node } from '@meyfa/cadence-audiograph'
import type { Numeric, Observable, Observer, UnsubscribeFn } from '@meyfa/cadence-utility'
import { DisposeStack, MutableObservable } from '@meyfa/cadence-utility'
import type { CacheLimits } from '../assets/fetcher.js'
import { createAudioFetcher } from '../assets/fetcher.js'
import type { MeterCallbacks } from '../graph/factory.js'
import type { GainMeasurement } from './engine.js'
import type { AudioSession } from './session.js'
import { createAudioSession } from './session.js'
import type { BeatRange } from './types.js'

export interface AudioEngineOptions {
  readonly outputGain: Numeric<'db'>
  readonly assetLoadTimeout: Numeric<'s'>
  readonly cacheLimits: CacheLimits
}

export interface AudioEngine {
  readonly outputGain: MutableObservable<Numeric<'db'>>

  readonly playing: Observable<boolean>
  readonly play: (graph: AudioGraph<Node>) => void
  readonly stop: () => void

  readonly range: MutableObservable<BeatRange>
  readonly position: Observable<Numeric<'beats'>>
  readonly errors: Observable<readonly Error[]>

  readonly meters: {
    readonly subscribeToGain: (key: EntityKey, observer: Observer<GainMeasurement>) => UnsubscribeFn
  }
}

export type { GainMeasurement } from '../worklets/metering/messages.js'

export function createAudioEngine (options: AudioEngineOptions): AudioEngine {
  const outputGain = new MutableObservable(options.outputGain)
  const fetcher = createAudioFetcher({
    timeout: options.assetLoadTimeout,
    cacheLimits: options.cacheLimits
  })

  const playing = new MutableObservable(false)
  const range = new MutableObservable<BeatRange>({ start: 0 as Numeric<'beats'> })
  const position = new MutableObservable(range.get().start)
  const errors = new MutableObservable<readonly Error[]>([])

  const gainMeters = new Map<string, MutableObservable<GainMeasurement>>()

  const meterCallbacks: MeterCallbacks = {
    onGain: (key, measurement) => gainMeters.get(key)?.set(measurement)
  }

  const resetMeters = () => {
    for (const meter of gainMeters.values()) {
      meter.set({ peak: [0, 0], rms: [0, 0] })
    }
  }

  let session: AudioSession | undefined
  let stopSession: (() => void) | undefined

  const play: AudioEngine['play'] = (graph) => {
    if (session != null) {
      return
    }

    const disposeStack = new DisposeStack()

    const thisSession = session = createAudioSession(graph, range.get(), outputGain, fetcher, meterCallbacks)
    disposeStack.pushDisposable(thisSession)

    const stopThisSession = stopSession = () => {
      disposeStack.dispose()

      if (session === thisSession) {
        session = undefined
        playing.set(false)
        resetMeters()
      }

      if (stopSession === stopThisSession) {
        stopSession = undefined
      }
    }

    disposeStack.push(thisSession.errors.subscribe((value) => {
      errors.set(value)
    }))

    disposeStack.push(thisSession.position.subscribe((value) => {
      position.set(value)
    }))

    disposeStack.push(thisSession.ended.subscribe((ended) => {
      if (ended) {
        stopThisSession()
      }
    }))

    resetMeters()

    thisSession.start()
    playing.set(true)
  }

  const stop: AudioEngine['stop'] = () => {
    stopSession?.()
  }

  const meters = {
    subscribeToGain: (key: EntityKey, observer: Observer<GainMeasurement>): UnsubscribeFn => {
      let meter = gainMeters.get(key)
      if (meter == null) {
        meter = new MutableObservable<GainMeasurement>({ peak: [0, 0], rms: [0, 0] })
        gainMeters.set(key, meter)
      }

      const unsubscribe = meter.subscribe(observer)

      return () => {
        unsubscribe()

        if (meter.observerCount <= 0) {
          gainMeters.delete(key)
        }
      }
    }
  }

  return { outputGain, playing, play, stop, range, position, errors, meters }
}
