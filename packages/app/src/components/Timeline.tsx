import type { StepRange } from '@core/audio/types.js'
import { makeNumeric, type Numeric, type Program, type Section } from '@core/program.js'
import clsx from 'clsx'
import React, { useCallback, useMemo, useRef, useState, type FunctionComponent } from 'react'
import { useGlobalMouseMove, useGlobalMouseUp } from '../hooks/input.js'
import { formatStepDuration } from '../utilities/strings.js'

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
  selection: StepRange
  setSelection: (range: StepRange) => void
  playbackProgress?: number
}> = ({ program, selection, setSelection, playbackProgress }) => {
  const totalStepCount = program.track.sections.reduce((sum, section) => sum + section.length.value, 0)

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
  const showSelection = totalStepCount > 0 && (isRangeSelection || selection.start.value > 0)

  return (
    <div className='h-full' onWheel={onWheel}>
      <div className='inline-block relative'>
        <TimeRuler
          beatsPerBar={program.beatsPerBar}
          stepsPerBeat={program.stepsPerBeat}
          totalStepCount={totalStepCount}
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
              stepsPerBeat={program.stepsPerBeat}
              beatWidth={beatWidth}
            />
          ))}
        </div>

        {showSelection && (
          <TimelineMarker
            variant={isRangeSelection ? 'start' : 'cursor'}
            position={selection.start}
            totalStepCount={totalStepCount}
            dimmed={playbackProgress != null}
          />
        )}

        {showSelection && selection.end != null && (
          <TimelineMarker
            variant='end'
            position={selection.end}
            totalStepCount={totalStepCount}
            dimmed={playbackProgress != null}
          />
        )}

        {playbackProgress != null && (
          <div
            className='absolute top-0 bottom-0 w-1 -ml-0.5 bg-accent-400 pointer-events-none'
            style={{
              left: `${playbackProgress * 100}%`
            }}
          />
        )}
      </div>
    </div>
  )
}

const TimeRuler: FunctionComponent<{
  beatsPerBar: number
  stepsPerBeat: number
  totalStepCount: number
  beatWidth: number
  selection: StepRange
  onSelect: (range: StepRange) => void
}> = ({ beatsPerBar, stepsPerBeat, totalStepCount, beatWidth, selection, onSelect }) => {
  const totalBeats = Math.ceil(totalStepCount / stepsPerBeat)

  const marks = useMemo<readonly number[]>(() => {
    const result: number[] = []

    for (let beat = 0; beat < totalBeats; ++beat) {
      result.push(beat % beatsPerBar)
    }

    return result
  }, [beatsPerBar, stepsPerBeat, totalBeats])

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<Numeric<'steps'> | undefined>(undefined)

  const computeStepFromEvent = useCallback((event: MouseEvent | React.MouseEvent): Numeric<'steps'> | undefined => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (rect == null) {
      return undefined
    }

    const stepWidth = beatWidth / stepsPerBeat
    if (stepWidth <= 0) {
      return undefined
    }

    const granularitySteps = stepWidth >= SELECTION_PIXELS_PER_NOTCH
      ? 1
      : beatWidth >= SELECTION_PIXELS_PER_NOTCH
        ? stepsPerBeat
        : beatsPerBar * stepsPerBeat

    const positionInPixels = event.clientX - rect.left
    const positionInSteps = positionInPixels / stepWidth

    const snappedStepIndex = Math.round(positionInSteps / granularitySteps) * granularitySteps
    const clampedStepIndex = Math.max(0, Math.min(snappedStepIndex, totalStepCount))

    return makeNumeric('steps', clampedStepIndex)
  }, [beatsPerBar, stepsPerBeat, beatWidth, totalStepCount])

  const updateSelection = useCallback((event: MouseEvent | React.MouseEvent) => {
    const position = computeStepFromEvent(event)
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
  }, [onSelect, selectionStart, computeStepFromEvent])

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()

    const position = computeStepFromEvent(event)
    if (position != null) {
      setIsSelecting(true)
      setSelectionStart(position)
      onSelect({ start: position })
    }
  }, [onSelect, computeStepFromEvent])

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
          className='absolute top-0 h-[calc(100%+0.5rem)] bg-accent-400 opacity-30 pointer-events-none -z-10'
          style={{
            left: `${(selection.start.value / totalStepCount) * 100}%`,
            width: `${((selection.end.value - selection.start.value) / totalStepCount) * 100}%`
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
  stepsPerBeat: number
  beatWidth: number
}> = ({ section, beatsPerBar, stepsPerBeat, beatWidth }) => {
  const sectionWidth = (section.length.value / stepsPerBeat) * beatWidth

  const lengthString = useMemo(() => {
    return formatStepDuration(section.length.value, { beatsPerBar, stepsPerBeat })
  }, [section, beatsPerBar, stepsPerBeat])

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
  position: Numeric<'steps'>
  totalStepCount: number
  dimmed: boolean
}> = ({ variant, position, totalStepCount, dimmed }) => {
  return (
    <div
      className={clsx(
        'absolute top-0 bottom-0 pointer-events-none',
        dimmed ? 'text-content-50' : 'text-content-100'
      )}
      style={{
        left: `${(position.value / totalStepCount) * 100}%`
      }}
    >
      <svg className='w-5 h-2.5 -ml-2.5' viewBox='0 0 16 8' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d={markerPathData[variant]} fill='currentColor' />
      </svg>
      <div className='absolute top-0 bg-current h-full w-0.5 -left-px' />
    </div>
  )
}
