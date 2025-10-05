import { gainToDb, getTransport, Sequence, Player, now } from 'tone'
import * as ast from '../language/ast.js'

export interface AudioDemo {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setProgram: (program: ast.Program) => void
}

export function createAudioDemo (options: {
  defaultTempo: number
}): AudioDemo {
  let initialized = false

  const players = new Map<string, Player>()
  const sequences = new Map<string, Sequence>()

  let decibels: number | undefined
  let program: ast.Program = {
    type: 'Program',
    track: undefined,
    assignments: [],
    routings: []
  }

  const init = () => {
    if (initialized) {
      return
    }

    getTransport().start()
    initialized = true
  }

  const configureTempo = () => {
    let tempo = options.defaultTempo

    const tempoProperty = findProperty(program.track?.properties ?? [], 'tempo')
    if (tempoProperty?.type === 'NumberLiteral' && tempoProperty.unit === 'bpm') {
      const { value } = tempoProperty
      if (Number.isFinite(value) && value > 1 && value <= 400) {
        tempo = value
      }
    }

    getTransport().bpm.value = tempo
  }

  const createPlayers = () => {
    for (const assignment of program.assignments) {
      const key = assignment.key.name

      if (assignment.value.type !== 'Call' || assignment.value.callee.name !== 'sample') {
        // TODO handle other types of assignments
        continue
      }

      const url = findProperty(assignment.value.arguments, 'url')
      if (url?.type !== 'StringLiteral') {
        continue
      }

      const player = new Player({
        url: url.value,
        autostart: false,
        loop: false
      }).toDestination()

      if (decibels != null) {
        player.volume.value = decibels
      }

      players.set(key, player)
    }
  }

  const createSequences = () => {
    for (const routing of program.routings) {
      const key = routing.instrument.name
      const player = players.get(key)
      if (player == null) {
        // TODO handle missing instrument
        continue
      }

      let pattern: ast.PatternLiteral | undefined

      switch (routing.pattern.type) {
        case 'PatternLiteral':
          pattern = routing.pattern
          break
        case 'Identifier': {
          const value = resolveIdentifierToValue(program, routing.pattern.name)
          if (value?.type === 'PatternLiteral') {
            pattern = value
          }
          // TODO handle invalid pattern reference
          break
        }
        default:
          // @ts-expect-error - should be unreachable
          throw new Error(`Unexpected pattern type: ${routing.pattern.type}`)
      }

      if (pattern == null) {
        // TODO handle missing pattern
        continue
      }

      const sequence = new Sequence<ast.Step>((time, note) => {
        if (note === 'hit') {
          player.start(time)
        }
      }, [...pattern.value], '16n')

      sequences.set(key, sequence)
    }
  }

  const startSequences = () => {
    for (const sequence of sequences.values()) {
      sequence.start(now() + 0.01)
    }
  }

  return {
    play: () => {
      init()

      configureTempo()

      createPlayers()
      createSequences()

      startSequences()
    },

    stop: () => {
      for (const sequence of sequences.values()) {
        sequence.stop()
      }

      players.clear()
      sequences.clear()
    },

    setVolume: (volume: number) => {
      decibels = gainToDb(Math.pow(volume, 2))

      for (const player of players.values()) {
        player.volume.rampTo(decibels, 0.05)
      }
    },

    setProgram: (newProgram) => {
      program = newProgram
    }
  }
}

function findProperty (properties: readonly ast.Property[], key: string): ast.Property['value'] | undefined {
  return properties.find((prop) => prop.key.name === key)?.value
}

function resolveIdentifierToValue (program: ast.Program, key: string): ast.Assignment['value'] | undefined {
  return program.assignments.find((a) => a.key.name === key)?.value
}
