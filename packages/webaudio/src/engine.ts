import type { AudioGraph, Node } from '@audiograph'
import type { BeatRange } from '@core'
import { MutableObservable, numeric, type Numeric, type Observable } from '@utility'
import { createAudioFetcher, type CacheLimits } from './assets/fetcher.js'
import { createAudioSession, type AudioSession } from './session.js'

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
}

export function createAudioEngine (options: AudioEngineOptions): AudioEngine {
  const outputGain = new MutableObservable(options.outputGain)
  const fetcher = createAudioFetcher({
    timeout: options.assetLoadTimeout,
    cacheLimits: options.cacheLimits
  })

  const playing = new MutableObservable(false)
  const range = new MutableObservable({ start: numeric('beats', 0) })
  const position = new MutableObservable(range.get().start)
  const errors = new MutableObservable<readonly Error[]>([])

  let session: AudioSession | undefined
  let stopSession: (() => void) | undefined

  const play: AudioEngine['play'] = (graph) => {
    if (session != null) {
      return
    }

    const subscriptions: Array<() => void> = []

    const thisSession = session = createAudioSession(graph, range.get(), outputGain, fetcher)

    const stopThisSession = stopSession = () => {
      thisSession.dispose()

      for (const unsubscribe of subscriptions) {
        unsubscribe()
      }

      if (session === thisSession) {
        session = undefined
        playing.set(false)
      }

      if (stopSession === stopThisSession) {
        stopSession = undefined
      }
    }

    subscriptions.push(thisSession.errors.subscribe((value) => {
      errors.set(value)
    }))

    subscriptions.push(thisSession.position.subscribe((value) => {
      position.set(value)
    }))

    subscriptions.push(thisSession.ended.subscribe((ended) => {
      if (ended) {
        stopThisSession()
      }
    }))

    thisSession.start()
    playing.set(true)
  }

  const stop: AudioEngine['stop'] = () => {
    stopSession?.()
  }

  return { outputGain, playing, play, stop, range, position, errors }
}
