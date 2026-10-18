import type { Numeric } from '@meyfa/cadence-utility'
import { useMemo } from 'react'
import { MINOR_TICKS_MIN_BEAT_WIDTH, RENDERING_LIMIT_BEATS, SELECTION_PIXELS_PER_NOTCH, SPARSE_BAR_LABELS_STRIDE_BARS } from './constants.ts'

export interface RulerOptions {
  readonly beatsPerBar: number
  readonly totalBeats: number
  readonly beatWidth: number
}

export interface Ruler {
  readonly limited: boolean

  readonly majorTickPath: string
  readonly minorTickPath: string
  readonly barLabelBeats: readonly number[]
}

export function useRuler (options: RulerOptions): Ruler {
  const { beatsPerBar, totalBeats, beatWidth } = options

  const limited = totalBeats > RENDERING_LIMIT_BEATS

  return useMemo(() => {
    if (limited) {
      return {
        limited,
        majorTickPath: '',
        minorTickPath: '',
        barLabelBeats: []
      }
    }

    const isZoomedFarOut = beatWidth < MINOR_TICKS_MIN_BEAT_WIDTH
    const majorStrideBeats = beatsPerBar * (isZoomedFarOut ? SPARSE_BAR_LABELS_STRIDE_BARS : 1)
    const minorStrideBeats = isZoomedFarOut ? beatsPerBar : 1

    const majorTicks: string[] = []
    const minorTicks: string[] = []
    const labels: number[] = []

    for (let beat = 0; beat <= totalBeats; beat += minorStrideBeats) {
      const x = beat * beatWidth
      if (beat % majorStrideBeats === 0) {
        majorTicks.push(`M${x} 0 V16`)
        labels.push(beat)
      } else {
        minorTicks.push(`M${x} 0 V4`)
      }
    }

    return {
      limited,
      majorTickPath: majorTicks.join(' '),
      minorTickPath: minorTicks.join(' '),
      barLabelBeats: labels
    }
  }, [beatsPerBar, totalBeats, beatWidth, limited])
}

interface GetBeatFromPositionOptions {
  readonly positionInPixels: number
  readonly beatsPerBar: number
  readonly totalBeats: number
  readonly beatWidth: number
}

export function getBeatFromPosition (options: GetBeatFromPositionOptions): Numeric<'beats'> {
  const { positionInPixels, beatsPerBar, totalBeats, beatWidth } = options

  const granularityBeats = beatWidth >= SELECTION_PIXELS_PER_NOTCH
    ? 1
    : beatsPerBar

  const positionInBeats = positionInPixels / beatWidth

  const snappedIndex = Math.round(positionInBeats / granularityBeats) * granularityBeats
  const clampedIndex = Math.max(0, Math.min(snappedIndex, totalBeats))

  return clampedIndex as Numeric<'beats'>
}
