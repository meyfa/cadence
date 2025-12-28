import { Player, Sequence } from 'tone'
import { convertPitchToPlaybackRate } from '../midi.js'
import { isPitch, makeNumeric, type Instrument, type InstrumentId, type Program, type Step } from '../program.js'
import { stepsToSeconds } from './time.js'
import { loopPattern, renderPatternSteps } from '@core/pattern.js'

export const DEFAULT_ROOT_NOTE = 'C5' as const

export type SequenceWithOffset = [sequence: Sequence<Step>, offset: number]

const STEP = makeNumeric('steps', 1)

export function createSequences (program: Program, players: Map<InstrumentId, Player>): readonly SequenceWithOffset[] {
  const subdivision = `${program.beatsPerBar * program.stepsPerBeat}n`

  const sequences: SequenceWithOffset[] = []

  const timePerStep = stepsToSeconds(STEP, program.track.tempo, program.stepsPerBeat).value
  let currentOffsetSteps = 0

  for (const section of program.track.sections) {
    const startOffset = currentOffsetSteps * timePerStep
    currentOffsetSteps += section.length.value

    for (const routing of section.routings) {
      const instrument = program.instruments.get(routing.destination.id)
      const player = players.get(routing.destination.id)

      if (instrument == null || player == null) {
        continue
      }

      const events = renderPatternSteps(loopPattern(routing.source.value), section.length.value)
      const sequence = new Sequence<Step>({
        callback: createCallback(instrument, player),
        events,
        subdivision,
        loop: false
      })

      sequences.push([sequence, startOffset])
    }
  }

  return sequences
}

function createCallback (instrument: Instrument, player: Player): (time: number, note: Step) => void {
  return (time: number, note: Step) => {
    if (note === '-' || !player.loaded) {
      return
    }

    const rootNote = instrument.rootNote ?? DEFAULT_ROOT_NOTE
    player.playbackRate = isPitch(note) ? convertPitchToPlaybackRate(note, rootNote) : 1

    player.start(time, undefined, instrument.length?.value)
  }
}
