import { Sequence, Player } from 'tone'
import { withPatternLength } from '../pattern.js'
import { convertPitchToPlaybackRate } from '../midi.js'
import { isPitch, type Instrument, type InstrumentId, type Program, type Step } from '../program.js'

export const DEFAULT_ROOT_NOTE = 'C5' as const

export type SequenceWithOffset = [sequence: Sequence<Step>, offset: number]

export function createSequences (players: Map<InstrumentId, Player>, program: Program): readonly SequenceWithOffset[] {
  const subdivision = `${program.beatsPerBar * program.stepsPerBeat}n`

  const sequences: SequenceWithOffset[] = []

  const timePerStep = 60 / (program.stepsPerBeat * program.track.tempo.value)
  let currentOffsetSteps = 0

  for (const section of program.track.sections) {
    const startOffset = currentOffsetSteps * timePerStep
    currentOffsetSteps += section.length.value

    for (const routing of section.routings) {
      const instrument = program.instruments.get(routing.instrumentId)
      const player = players.get(routing.instrumentId)

      if (instrument == null || player == null) {
        continue
      }

      // For some reason, Tone.js wants a mutable events array.
      const events = [...withPatternLength(routing.pattern, section.length.value)]
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
