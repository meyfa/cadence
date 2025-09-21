import { gainToDb, getTransport, Pattern, PolySynth, Synth } from 'tone'

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
}

export function createAudioDemo (): AudioDemo {
  let initialized = false
  let synth: PolySynth | undefined
  let pattern: Pattern<string> | undefined
  let decibels: number | undefined

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

        pattern = new Pattern(function (time, note) {
          synth?.triggerAttackRelease(note, 0.125, time)
        }, ['G4', 'D4', 'F4', 'A4'])

        pattern.interval = '12n'

        getTransport().start()
      }

      pattern?.start()
    },

    stop: () => {
      pattern?.stop()
    },

    setVolume: (volume: number) => {
      decibels = gainToDb(Math.pow(volume, 2))

      if (synth != null) {
        synth.volume.rampTo(decibels, 0.05)
      }
    }
  }
}
