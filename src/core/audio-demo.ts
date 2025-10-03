import { gainToDb, getTransport, Sequence, Player } from 'tone'

type PatternItem = 'rest' | 'hit'

interface Program {
  track?: {
    tempo?: number
  }
  patterns: Record<string, PatternItem[]>
}

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setProgram: (program: Program) => void
}

export function createAudioDemo (options: {
  instruments: Record<string, string>
  defaultTempo: number
}): AudioDemo {
  let initialized = false

  const players: Record<string, Player> = {}
  const sequences: Record<string, Sequence> = {}

  let decibels: number | undefined
  let currentProgram: Program = {
    patterns: {}
  }

  return {
    play: () => {
      if (!initialized) {
        initialized = true

        for (const [key, url] of Object.entries(options.instruments)) {
          const player = new Player({
            url,
            autostart: false,
            loop: false
          }).toDestination()

          if (decibels != null) {
            player.volume.value = decibels
          }

          players[key] = player

          const pattern = currentProgram.patterns[key] ?? []
          const sequence = new Sequence<PatternItem>((time, note) => {
            if (note === 'hit') {
              player.start(time)
            }
          }, pattern, '16n')

          sequences[key] = sequence
        }

        getTransport().start()
      }

      for (const sequence of Object.values(sequences)) {
        sequence.start()
      }
    },

    stop: () => {
      for (const sequence of Object.values(sequences)) {
        sequence.stop()
      }
    },

    setVolume: (volume: number) => {
      decibels = gainToDb(Math.pow(volume, 2))

      for (const player of Object.values(players)) {
        player.volume.rampTo(decibels, 0.05)
      }
    },

    setProgram: (program) => {
      currentProgram = program

      let tempo = program.track?.tempo ?? options.defaultTempo
      if (!Number.isFinite(tempo) || tempo <= 1 || tempo > 400) {
        tempo = options.defaultTempo
      }

      getTransport().bpm.value = tempo

      for (const [key, sequence] of Object.entries(sequences)) {
        const pattern = currentProgram.patterns[key] ?? []
        sequence.events = pattern
      }
    }
  }
}
