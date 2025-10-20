import { type Numeric, type Program } from '../program.js'
import { MutableObservable, type Observable } from '../observable.js'
import { createAudioSession, type AudioSession } from './session.js'
import { getDestination } from 'tone'

export interface AudioEngineOptions {
  readonly outputGain: Numeric<'db'>
}

export interface AudioEngine {
  readonly outputGain: MutableObservable<Numeric<'db'>>

  readonly playing: Observable<boolean>
  readonly play: (program: Program) => void
  readonly stop: () => void

  readonly progress: Observable<number>
}

export function createAudioEngine (options: AudioEngineOptions): AudioEngine {
  const outputGain = new MutableObservable(options.outputGain)

  outputGain.subscribe(({ value }) => {
    getDestination().volume.rampTo(value, 0.05)
  })

  const playing = new MutableObservable(false)
  const progress = new MutableObservable(0)
  let session: AudioSession | undefined

  const play = (program: Program) => {
    if (session != null) {
      return
    }

    const thisSession = session = createAudioSession(program)

    const unsubscribeProgress = thisSession.progress.subscribe((p) => {
      progress.set(p)
    })

    const unsubscribeEnded = thisSession.ended.subscribe((ended) => {
      if (ended && session === thisSession) {
        session.dispose()
        session = undefined
        playing.set(false)
        unsubscribeProgress()
        unsubscribeEnded()
      }
    })

    thisSession.start()
    playing.set(true)
  }

  const stop = () => {
    session?.dispose()
    session = undefined
    playing.set(false)
  }

  return { outputGain, playing, play, stop, progress }
}
