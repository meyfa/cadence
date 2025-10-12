import { gainToDb, getTransport, Sequence, Player, getDestination } from 'tone'
import { makeNumeric, type InstrumentId, type Program, type Step } from './program.js'
import { getSilentPattern, withPatternLength } from './pattern.js'

const LOAD_TIMEOUT_MS = 3000

export interface AudioEngine {
  readonly play: () => void
  readonly stop: () => void
  readonly setVolume: (volume: number) => void
  readonly setProgram: (program: Program) => void
}

export function createAudioEngine (): AudioEngine {
  const players = new Map<InstrumentId, Player>()
  const sequences = new Map<InstrumentId, Sequence<Step>>()

  // Increments on play() and stop(), to cancel pending playback
  let playSession = 0

  let decibels: number | undefined
  let program: Program = {
    beatsPerBar: 4,
    stepsPerBeat: 4,
    instruments: new Map(),
    track: {
      tempo: makeNumeric('bpm', 128),
      sections: []
    }
  }

  const resetTransport = () => {
    const transport = getTransport()
    transport.stop()
    transport.cancel()
    transport.position = 0
  }

  const configureOutput = () => {
    if (decibels != null) {
      getDestination().volume.value = decibels
    }

    getTransport().bpm.value = program.track.tempo.value
  }

  const createPlayers = (): Array<Promise<Player>> => {
    players.clear()

    const loads: Array<Promise<Player>> = []

    for (const instrument of program.instruments.values()) {
      const player = new Player({ autostart: false, loop: false }).toDestination()
      if (instrument.gain != null) {
        player.volume.value = instrument.gain.value
      }
      loads.push(player.load(instrument.sampleUrl))
      players.set(instrument.id, player)
    }

    return loads
  }

  const waitForLoadsOrTimeout = async (loads: Array<Promise<Player>>, timeoutMs: number): Promise<void> => {
    if (loads.length === 0) {
      return
    }

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    const loadsIgnoreErrors = Promise.allSettled(loads.map((p) => p.catch(() => {})))

    await Promise.race([loadsIgnoreErrors, timeout])
  }

  const createSequences = () => {
    const sequenceEvents = new Map<InstrumentId, Step[]>([
      // Initialize with empty arrays for all instruments
      ...Array.from(players.keys(), (id): [InstrumentId, Step[]] => [id, []])
    ])

    for (const section of program.track.sections) {
      // Remember which instruments were used in this section
      const used = new Set<InstrumentId>()

      for (const routing of section.routings) {
        const player = players.get(routing.instrumentId)
        const events = sequenceEvents.get(routing.instrumentId)

        if (!used.has(routing.instrumentId) && player != null && events != null) {
          events.push(...withPatternLength(routing.pattern, section.length.value))
          used.add(routing.instrumentId)
        }
      }

      // Handle instruments not used in this section by adding "rest" steps
      for (const [key, events] of sequenceEvents) {
        if (!used.has(key)) {
          events.push(...getSilentPattern(section.length.value))
        }
      }
    }

    sequences.clear()

    const subdivision = `${(program.beatsPerBar * program.stepsPerBeat).toFixed(0)}n`

    for (const [key, player] of players) {
      const events = sequenceEvents.get(key) ?? []

      sequences.set(key, new Sequence<Step>((time, note) => {
        if (note === 'hit') {
          player.start(time)
        }
      }, events, subdivision))
    }
  }

  const startSequences = () => {
    for (const sequence of sequences.values()) {
      sequence.start()
    }
  }

  return {
    play: () => {
      const session = ++playSession

      resetTransport()

      configureOutput()
      const loads = createPlayers()
      createSequences()

      // Defer start until samples are loaded or timeout reached
      waitForLoadsOrTimeout(loads, LOAD_TIMEOUT_MS).then(() => {
        if (session === playSession) {
          startSequences()
          getTransport().start('+0.05')
        }
      }).catch((_err: unknown) => {
        // ignore
      })
    },

    stop: () => {
      // Invalidate any pending start from a previous play()
      ++playSession

      for (const sequence of sequences.values()) {
        sequence.stop()
        sequence.dispose()
      }

      sequences.clear()
      resetTransport()
    },

    setVolume: (volume: number) => {
      decibels = gainToDb(Math.pow(volume, 2))
      getDestination().volume.rampTo(decibels, 0.05)
    },

    setProgram: (newProgram) => {
      program = newProgram
    }
  }
}
