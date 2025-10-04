import { gainToDb, getTransport, Sequence, Player, now } from 'tone'
import * as ast from '../language/ast.js'

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setProgram: (program: ast.Program) => void
}

export function createAudioDemo (options: {
  instruments: Record<string, string>
  defaultTempo: number
}): AudioDemo {
  let initialized = false

  const players: Record<string, Player> = {}
  const sequences: Record<string, Sequence> = {}

  let decibels: number | undefined
  let currentProgram: ast.Program = {
    type: 'Program',
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

          const pattern = currentProgram.patterns[key] ?? { type: 'Pattern', steps: [] }
          const sequence = new Sequence<ast.Step>((time, note) => {
            if (note === 'hit') {
              player.start(time)
            }
          }, pattern.steps, '16n')

          sequences[key] = sequence
        }

        getTransport().start()
      }

      for (const sequence of Object.values(sequences)) {
        sequence.start(now() + 0.01)
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

      let tempo = findProperty(program.track?.properties ?? [], 'tempo')?.value
      if (tempo == null || !Number.isFinite(tempo) || tempo <= 1 || tempo > 400) {
        tempo = options.defaultTempo
      }

      getTransport().bpm.value = tempo

      for (const [key, sequence] of Object.entries(sequences)) {
        const pattern = currentProgram.patterns[key] ?? { type: 'Pattern', steps: [] }
        sequence.events = pattern.steps
      }
    }
  }
}

function findProperty (properties: ast.Property[], key: string): ast.Property['value'] | undefined {
  return properties.find((prop) => prop.key === key)?.value
}
