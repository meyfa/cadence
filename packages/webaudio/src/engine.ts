import { MutableObservable, type Observable } from '@core/observable.js'
import { makeNumeric, type Numeric, type Program } from '@core/program.js'
import type { BeatRange } from '@core/types.js'
import { createAudioFetcher } from './assets/fetcher.js'
import { createAudioSession, type AudioSession } from './session.js'

export interface AudioEngineOptions {
  readonly outputGain: Numeric<'db'>
  readonly assetLoadTimeout: Numeric<'s'>

  readonly cacheLimits: {
    readonly arrayBuffer: number
    readonly audioBuffer: number
  }
}

export interface AudioEngine {
  readonly outputGain: MutableObservable<Numeric<'db'>>

  readonly playing: Observable<boolean>
  readonly play: (program: Program) => void
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
  const range = new MutableObservable({ start: makeNumeric('beats', 0) })
  const position = new MutableObservable(range.get().start)
  const errors = new MutableObservable<readonly Error[]>([])

  let session: AudioSession | undefined
  let stopSession: (() => void) | undefined

  const play = (program: Program) => {
    if (session != null) {
      return
    }

    const subscriptions: Array<() => void> = []

    const thisSession = session = createAudioSession(program, range.get(), outputGain, fetcher)

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

  const stop = () => {
    stopSession?.()
  }

  return { outputGain, playing, play, stop, range, position, errors }
}
