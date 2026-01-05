import type { BeatRange } from '@core/types.js'
import { makeNumeric, type Numeric, type Program, type Section } from '@core/program.js'
import clsx from 'clsx'
import React, { useCallback, useMemo, useRef, useState, type FunctionComponent } from 'react'
import { useGlobalMouseMove, useGlobalMouseUp } from '../hooks/input.js'
import { formatBeatDuration } from '../utilities/strings.js'
import { calculateTotalLength } from '@core/audio/time.js'

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
          {program.track.sections.map((section, index) => (
            <TimelineSection
              key={index}
              section={section}
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

  const marks = useMemo<readonly number[]>(() => {
    const result: number[] = []

    for (let beat = 0; beat < totalBeats; ++beat) {
      result.push(beat % beatsPerBar)
    }

    return result
  }, [beatsPerBar, totalBeats])

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
      {selection.end != null && (
        <div
          className='absolute top-0 h-[calc(100%+0.5rem)] bg-accent-100 opacity-40 pointer-events-none -z-10'
          style={{
            left: `${(selection.start.value / trackLength.value) * 100}%`,
            width: `${((selection.end.value - selection.start.value) / trackLength.value) * 100}%`
          }}
        />
      )}

      {marks.map((mark, index) => (
        <div
          key={index}
          className={clsx(
            'border-l border-l-current',
            mark === 0 ? 'h-4' : 'h-1'
          )}
          style={{
            width: beatWidth,
            transition: `width ${TIMELINE_TRANSITION_DURATION} ${TIMELINE_TRANSITION_EASING}`
          }}
        >
          {mark === 0 && (
            <div className='mt-0.5 ml-1'>
              {index / beatsPerBar}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const TimelineSection: FunctionComponent<{
  section: Section
  beatsPerBar: number
  beatWidth: number
}> = ({ section, beatsPerBar, beatWidth }) => {
  const sectionWidth = section.length.value * beatWidth

  const lengthString = useMemo(() => {
    return formatBeatDuration(section.length, beatsPerBar)
  }, [section, beatsPerBar])

  return (
    <div
      className={clsx(
        'px-2 py-1 text-sm leading-tight text-nowrap overflow-hidden text-ellipsis select-none',
        'rounded-md bg-surface-200 border border-frame-200 text-content-200'
      )}
      style={{
        width: sectionWidth,
        transition: `width ${TIMELINE_TRANSITION_DURATION} ${TIMELINE_TRANSITION_EASING}`
      }}
    >
      {section.name}

      <div className='text-content-100'>
        {lengthString}
      </div>
    </div>
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
