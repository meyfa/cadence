import { makeNumeric, type Numeric, type Part, type Program } from '@core/program.js'
import { calculateTotalLength } from '@core/time.js'
import type { BeatRange } from '@core/types.js'
import clsx from 'clsx'
import React, { useCallback, useMemo, useRef, useState, type FunctionComponent } from 'react'
import { useGlobalMouseMove, useGlobalMouseUp } from '../hooks/input.js'
import { formatBeatDuration, formatBeatDurationAsWords } from '../utilities/strings.js'
import { Popover } from './Popover.js'

const TIMELINE_ZOOM_MIN = 4
const TIMELINE_ZOOM_MAX = 64
const TIMELINE_ZOOM_DEFAULT = 16

const TIMELINE_ZOOM_STEP = 2

const TIMELINE_TRANSITION_DURATION = '100ms'
const TIMELINE_TRANSITION_EASING = 'ease'

// When one step is at least this wide, then selection works at step granularity.
// Otherwise, when one beat is at least this wide, selection works at beat granularity.
// Otherwise, selection works at bar granularity.
const SELECTION_PIXELS_PER_NOTCH = 10

// When zoomed far out, minor ticks (non-bar) become noisy and expensive.
const MINOR_TICKS_MIN_BEAT_WIDTH = 10

// When zoomed far out, bar labels are reduced to every N bars (stride).
const SPARSE_BAR_LABELS_STRIDE_BARS = 4

export const Timeline: FunctionComponent<{
  program: Program
  selection: BeatRange
  setSelection: (range: BeatRange) => void
  playbackPosition?: Numeric<'beats'>
}> = ({ program, selection, setSelection, playbackPosition }) => {
  const trackLength = calculateTotalLength(program)

  const [beatWidth, setBeatWidth] = useState(TIMELINE_ZOOM_DEFAULT)

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const modifierKeysPressed = event.ctrlKey || event.shiftKey || event.metaKey || event.altKey
    if (modifierKeysPressed) {
      return
    }

    event.preventDefault()

    const delta = TIMELINE_ZOOM_STEP * Math.sign(event.deltaY)
    setBeatWidth((prev) => Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, prev - delta)))
  }, [])

  const isRangeSelection = selection.end != null && selection.end.value > selection.start.value
  const showSelection = trackLength.value > 0 && (isRangeSelection || selection.start.value > 0)

  return (
    <div className='h-full' onWheel={onWheel}>
      <div className='inline-block relative'>
        <TimeRuler
          beatsPerBar={program.beatsPerBar}
          trackLength={trackLength}
          beatWidth={beatWidth}
          selection={selection}
          onSelect={setSelection}
        />

        <div className='flex w-fit mt-2'>
          {program.track.parts.map((part, index) => (
            <TimelinePart
              key={index}
              part={part}
              beatsPerBar={program.beatsPerBar}
              beatWidth={beatWidth}
            />
          ))}
        </div>

        {showSelection && (
          <TimelineMarker
            variant={isRangeSelection ? 'start' : 'cursor'}
            position={selection.start}
            trackLength={trackLength}
            dimmed={playbackPosition != null}
          />
        )}

        {showSelection && selection.end != null && (
          <TimelineMarker
            variant='end'
            position={selection.end}
            trackLength={trackLength}
            dimmed={playbackPosition != null}
          />
        )}

        {playbackPosition != null && (
          <div
            className='absolute top-0 bottom-0 w-1 -ml-0.5 bg-accent-100 pointer-events-none'
            style={{
              left: `${(playbackPosition.value / trackLength.value) * 100}%`
            }}
          />
        )}
      </div>
    </div>
  )
}

const TimeRuler: FunctionComponent<{
  beatsPerBar: number
  trackLength: Numeric<'beats'>
  beatWidth: number
  selection: BeatRange
  onSelect: (range: BeatRange) => void
}> = ({ beatsPerBar, trackLength, beatWidth, selection, onSelect }) => {
  const totalBeats = Math.ceil(trackLength.value)

  const { majorTickPath, minorTickPath, barLabelBeats } = useMemo(() => {
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
      majorTickPath: majorTicks.join(' '),
      minorTickPath: minorTicks.join(' '),
      barLabelBeats: labels
    }
  }, [beatsPerBar, totalBeats, beatWidth])

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<Numeric<'beats'> | undefined>(undefined)

  const computeTimeFromEvent = useCallback((event: MouseEvent | React.MouseEvent): Numeric<'beats'> | undefined => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (rect == null || beatWidth <= 0) {
      return undefined
    }

    const granularityBeats = beatWidth >= SELECTION_PIXELS_PER_NOTCH
      ? 1
      : beatsPerBar

    const positionInPixels = event.clientX - rect.left
    const positionInBeats = positionInPixels / beatWidth

    const snappedIndex = Math.round(positionInBeats / granularityBeats) * granularityBeats
    const clampedIndex = Math.max(0, Math.min(snappedIndex, trackLength.value))

    return makeNumeric('beats', clampedIndex)
  }, [beatsPerBar, beatWidth, trackLength])

  const updateSelection = useCallback((event: MouseEvent | React.MouseEvent) => {
    const position = computeTimeFromEvent(event)
    if (position == null || selectionStart == null) {
      return
    }

    if (selectionStart.value === position.value) {
      onSelect({ start: position })
      return
    }

    onSelect({
      start: position.value < selectionStart.value ? position : selectionStart,
      end: position.value >= selectionStart.value ? position : selectionStart
    })
  }, [onSelect, selectionStart, computeTimeFromEvent])

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const position = computeTimeFromEvent(event)
    if (position != null) {
      setIsSelecting(true)
      setSelectionStart(position)
      onSelect({ start: position })
    }
  }, [onSelect, computeTimeFromEvent])

  useGlobalMouseUp(() => {
    setIsSelecting(false)
    setSelectionStart(undefined)
  }, [])

  useGlobalMouseMove((event) => {
    if (isSelecting) {
      updateSelection(event)
    }
  }, [isSelecting, updateSelection])

  return (
    <div
      className='relative flex w-fit select-none text-content-200 text-xs font-bold cursor-text'
      ref={timelineRef}
      onMouseDown={onMouseDown}
    >
      {trackLength.value > 0 && selection.end != null && (
        <div
          className='absolute top-0 h-[calc(100%+0.5rem)] bg-accent-100 opacity-40 pointer-events-none -z-10'
          style={{
            left: `${(selection.start.value / trackLength.value) * 100}%`,
            width: `${((selection.end.value - selection.start.value) / trackLength.value) * 100}%`
          }}
        />
      )}

      <svg
        className='block'
        width={totalBeats * beatWidth}
        height={16}
        style={{
          width: totalBeats * beatWidth,
          height: 16,
          transition: `width ${TIMELINE_TRANSITION_DURATION} ${TIMELINE_TRANSITION_EASING}`
        }}
      >
        <path d={minorTickPath} stroke='currentColor' strokeWidth={1} />
        <path d={majorTickPath} stroke='currentColor' strokeWidth={1} />

        {barLabelBeats.map((beat) => (
          <text
            key={beat}
            x={beat * beatWidth + 4}
            y={12}
            fill='currentColor'
            style={{ fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}
          >
            {beat / beatsPerBar}
          </text>
        ))}
      </svg>
    </div>
  )
}

const TimelinePart: FunctionComponent<{
  part: Part
  beatsPerBar: number
  beatWidth: number
}> = ({ part, beatsPerBar, beatWidth }) => {
  const partWidth = part.length.value * beatWidth
  const borderWidth = partWidth >= 2 ? 1 : 0
  const maxPaddingX = Math.max(0, (partWidth - borderWidth * 2) / 2)
  const paddingX = Math.min(8, maxPaddingX)

  const [lengthShort, lengthLong] = useMemo(() => {
    return [
      formatBeatDuration(part.length, beatsPerBar),
      formatBeatDurationAsWords(part.length, beatsPerBar)
    ]
  }, [part, beatsPerBar])

  // must be reactive, so no ref
  const [container, setContainer] = useState<HTMLElement | null>(null)

  const [popoverOpen, setPopoverOpen] = useState(false)
  const openPopover = useCallback(() => setPopoverOpen(true), [])
  const closePopover = useCallback(() => setPopoverOpen(false), [])

  return (
    <>
      <button
        type='button'
        className={clsx(
          'py-1 text-sm leading-tight text-start text-nowrap overflow-clip text-ellipsis select-none rounded-md -outline-offset-2 cursor-pointer',
          'bg-surface-200 border-frame-200 text-content-200',
          'hocus:outline-2 hocus:outline-accent-200 hocus:bg-surface-300 hocus:border-frame-300 hocus:text-content-300'
        )}
        style={{
          width: partWidth,
          paddingLeft: paddingX,
          paddingRight: paddingX,
          borderStyle: borderWidth > 0 ? 'solid' : 'none',
          borderWidth,
          transition: `width ${TIMELINE_TRANSITION_DURATION} ${TIMELINE_TRANSITION_EASING}`
        }}
        ref={setContainer}
        onClick={openPopover}
      >
        {part.name}

        <div className='text-content-100'>
          {lengthShort}
        </div>
      </button>

      {popoverOpen && (
        <Popover anchor={container} onClose={closePopover}>
          <div className='font-bold'>{`part.${part.name}`}</div>
          <div>length: {lengthLong}</div>
        </Popover>
      )}
    </>
  )
}

const markerPathData = {
  cursor: 'M0,0 H16 L8,8 Z',
  start: 'M0,0 H8 L8,8 Z',
  end: 'M8,0 H16 L8,8 Z'
}

const TimelineMarker: FunctionComponent<{
  variant: 'cursor' | 'start' | 'end'
  position: Numeric<'beats'>
  trackLength: Numeric<'beats'>
  dimmed: boolean
}> = ({ variant, position, trackLength, dimmed }) => {
  return (
    <div
      className={clsx(
        'absolute top-0 bottom-0 pointer-events-none',
        dimmed ? 'text-content-50' : 'text-content-100'
      )}
      style={{
        left: `${(position.value / trackLength.value) * 100}%`
      }}
    >
      <svg className='w-5 h-2.5 -ml-2.5' viewBox='0 0 16 8' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d={markerPathData[variant]} fill='currentColor' />
      </svg>
      <div className='absolute top-0 bg-current h-full w-0.5 -left-px' />
    </div>
  )
}
