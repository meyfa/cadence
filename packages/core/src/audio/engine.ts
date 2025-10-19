import { type Program } from '../program.js'
import { MutableObservable, type Observable } from '../observable.js'
import { createAudioSession, type AudioSession } from './session.js'
import { gainToDb, getDestination } from 'tone'

export interface AudioEngineOptions {
  readonly volume: number
}

export interface AudioEngine {
  readonly volume: MutableObservable<number>

  readonly playing: Observable<boolean>
  readonly play: (program: Program) => void
  readonly stop: () => void

  readonly progress: Observable<number>
}

export function createAudioEngine (options: AudioEngineOptions): AudioEngine {
  const volume = new MutableObservable(options.volume)

  volume.subscribe((volume) => {
    const volumeDecibels = gainToDb(Math.pow(volume, 2))
    getDestination().volume.rampTo(volumeDecibels, 0.05)
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

  return { volume, playing, play, stop, progress }
}
