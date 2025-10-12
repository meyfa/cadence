import { gainToDb, getTransport, Sequence, Player, getDestination } from 'tone'
import { isPitch, makeNumeric, type InstrumentId, type Program, type Step } from './program.js'
import { getSilentPattern, withPatternLength } from './pattern.js'
import { MutableObservable, type Observable } from './observable.js'
import { convertPitchToPlaybackRate } from './midi.js'

const LOAD_TIMEOUT_MS = 3000
const DEFAULT_ROOT_NOTE = 'C5' as const

const emptyProgram: Program = {
  beatsPerBar: 4,
  stepsPerBeat: 4,
  instruments: new Map(),
  track: {
    tempo: makeNumeric('bpm', 128),
    sections: []
  }
}

export interface AudioEngineOptions {
  readonly volume: number
}

export interface AudioEngine {
  readonly playing: Observable<boolean>
  readonly volume: Observable<number>

  readonly play: () => void
  readonly stop: () => void

  readonly setVolume: (volume: number) => void

  readonly setProgram: (program: Program) => void
}

export function createAudioEngine (options: AudioEngineOptions): AudioEngine {
  const playing = new MutableObservable(false)
  const volume = new MutableObservable(options.volume)

  const players = new Map<InstrumentId, Player>()
  const sequences = new Map<InstrumentId, Sequence<Step>>()

  // Increments on play() and stop(), to cancel pending playback
  let playSession = 0

  let program = emptyProgram

  const resetTransport = () => {
    const transport = getTransport()
    transport.stop()
    transport.cancel()
    transport.position = 0
  }

  const configureOutput = () => {
    getDestination().volume.value = convertVolumeToDb(volume.get())
    getTransport().bpm.value = program.track.tempo.value
  }

  const createPlayers = (): Array<Promise<Player>> => {
    players.clear()

    const loads: Array<Promise<Player>> = []

    for (const instrument of program.instruments.values()) {
      const player = new Player({
        autostart: false,
        loop: false,
        // declick
        fadeIn: 0.005,
        fadeOut: 0.005
      }).toDestination()

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

    const subdivision = `${program.beatsPerBar * program.stepsPerBeat}n`

    for (const [key, player] of players) {
      const events = sequenceEvents.get(key) ?? []

      const instrument = program.instruments.get(key)
      if (instrument == null) {
        continue
      }

      const callback = (time: number, note: Step) => {
        if (note === '-') {
          return
        }

        const rootNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE
        player.playbackRate = isPitch(note) ? convertPitchToPlaybackRate(note, rootNote) : 1

        player.start(time, undefined, instrument.length?.value)
      }

      sequences.set(key, new Sequence<Step>({ callback, events, subdivision, loop: false }))
    }
  }

  const startSequences = (onDone?: () => void) => {
    let maxLength = 0

    for (const sequence of sequences.values()) {
      maxLength = Math.max(maxLength, sequence.length * sequence.subdivision)
      sequence.start()
    }

    if (onDone != null) {
      getTransport().scheduleOnce(() => onDone(), `+${maxLength}`)
    }
  }

  const play = () => {
    const session = ++playSession

    resetTransport()

    configureOutput()
    const loads = createPlayers()
    createSequences()

    playing.set(true)

    const onDone = () => {
      if (session === playSession) {
        playing.set(false)
      }
    }

    // Defer start until samples are loaded or timeout reached
    waitForLoadsOrTimeout(loads, LOAD_TIMEOUT_MS).then(() => {
      if (session === playSession) {
        startSequences(onDone)
        getTransport().start('+0.05')
      }
    }).catch((_err: unknown) => {
      // ignore
    })
  }

  const stop = () => {
    // Invalidate any pending start from a previous play()
    ++playSession

    for (const sequence of sequences.values()) {
      sequence.stop()
      sequence.dispose()
    }
    sequences.clear()

    for (const player of players.values()) {
      player.stop()
      player.dispose()
    }
    players.clear()

    resetTransport()

    playing.set(false)
  }

  const setVolume = (newVolume: number): void => {
    volume.set(newVolume)
    getDestination().volume.rampTo(convertVolumeToDb(newVolume), 0.05)
  }

  const setProgram = (newProgram: Program): void => {
    program = newProgram
  }

  return {
    playing,
    volume,
    play,
    stop,
    setVolume,
    setProgram
  }
}

function convertVolumeToDb (volume: number): number {
  return gainToDb(Math.pow(volume, 2))
}
