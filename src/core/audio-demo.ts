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
  const sequences = new Map<string, Sequence<ast.Step>>()

  let decibels: number | undefined
  let program: ast.Program = {
    type: 'Program',
    track: undefined,
    assignments: []
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
    players.clear()

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
    const sequenceEvents = new Map<string, ast.Step[]>([
      ...players.keys()].map((key) => [key, [] as ast.Step[]
    ]))

    for (const section of program.track?.sections ?? []) {
      if (section.length.unit !== 'bars' || !Number.isSafeInteger(section.length.value) || section.length.value <= 0) {
        // TODO handle other units
        continue
      }

      const sectionLengthSteps = section.length.value * 16

      // Remember which instruments were used in this section
      const instruments = new Set<string>()

      for (const routing of section.routings) {
        const key = routing.instrument.name
        if (instruments.has(key)) {
          // TODO handle duplicate instrument in same section
          continue
        }

        instruments.add(key)

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
          continue
        }

        const events = sequenceEvents.get(key)
        if (events == null) {
          // TODO handle missing instrument
          continue
        }

        // Expand pattern to fit section length
        const repeats = Math.ceil(sectionLengthSteps / pattern.value.length)
        const steps = new Array<readonly ast.Step[]>(repeats).fill(pattern.value).flat().slice(0, sectionLengthSteps)

        events.push(...steps)
      }

      // Handle instruments not used in this section by adding "rest" steps
      for (const [key, events] of sequenceEvents) {
        if (!instruments.has(key)) {
          events.push(...new Array<ast.Step>(sectionLengthSteps).fill('rest'))
        }
      }
    }

    sequences.clear()

    for (const [key, player] of players) {
      const events = sequenceEvents.get(key) ?? []

      sequences.set(key, new Sequence<ast.Step>((time, note) => {
        if (note === 'hit') {
          player.start(time)
        }
      }, events, '16n'))
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
