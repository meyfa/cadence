import { gainToDb, getTransport, PolySynth, Sequence, Synth } from 'tone'

type PatternItem = 'rest' | 'hit'

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setPattern: (pattern: PatternItem[]) => void
}

export function createAudioDemo (): AudioDemo {
  let initialized = false
  let synth: PolySynth | undefined
  let seq: Sequence | undefined
  let decibels: number | undefined
  let events: PatternItem[] = ['rest']

  return {
    play: () => {
      if (!initialized) {
        initialized = true

        getTransport().bpm.value = 128

        synth = new PolySynth(Synth, {
          oscillator: {
            type: 'sine'
          },
          envelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0,
            release: 0.1
          }
        }).toDestination()

        if (decibels != null) {
          synth.volume.value = decibels
        }

        seq = new Sequence((time, note) => {
          if (note === 'hit') {
            synth?.triggerAttackRelease('C4', '8n', time)
          }
        }, events, '16n')

        getTransport().start()
      }

      seq?.start()
    },

    stop: () => {
      seq?.stop()
    },

    setVolume: (volume: number) => {
      decibels = gainToDb(Math.pow(volume, 2))

      if (synth != null) {
        synth.volume.rampTo(decibels, 0.05)
      }
    },

    setPattern: (pattern) => {
      events = pattern

      if (seq != null) {
        seq.events = events
      }
    }
  }
}
