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
  startPosition: Numeric<'steps'>
  setStartPosition: (position: Numeric<'steps'>) => void
  playbackProgress?: number
}> = ({ program, startPosition, setStartPosition, playbackProgress }) => {
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

  return (
    <div className='h-full' onWheel={onWheel}>
      <div className='inline-block relative'>
        <TimeRuler
          beatsPerBar={program.beatsPerBar}
          stepsPerBeat={program.stepsPerBeat}
          totalStepCount={totalStepCount}
          beatWidth={beatWidth}
          setStartPosition={setStartPosition}
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

        {startPosition.value > 0 && totalStepCount > 0 && (
          <div
            className={clsx(
              'absolute top-0 bottom-0 pointer-events-none text-content-100',
              playbackProgress != null ? 'opacity-60' : ''
            )}
            style={{
              left: `${(startPosition.value / totalStepCount) * 100}%`
            }}
          >
            <svg className='w-5 h-2.5 -ml-2.5' viewBox='0 0 16 8' fill='none' xmlns='http://www.w3.org/2000/svg'>
              <path d='M0,0 H16 L8,8 Z' fill='currentColor' />
            </svg>
            <div className='w-0.5 -ml-px bg-current h-[calc(100%-0.625rem)]' />
          </div>
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
  setStartPosition: (position: Numeric<'steps'>) => void
}> = ({ beatsPerBar, stepsPerBeat, totalStepCount, beatWidth, setStartPosition }) => {
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

  const updateSelection = useCallback((event: MouseEvent | React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (rect == null) {
      return
    }

    const stepWidth = beatWidth / stepsPerBeat
    if (stepWidth <= 0) {
      return
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

    setStartPosition(makeNumeric('steps', clampedStepIndex))
  }, [beatsPerBar, stepsPerBeat, beatWidth, setStartPosition])

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    setIsSelecting(true)
    updateSelection(event)
  }, [updateSelection])

  useGlobalMouseUp(() => {
    setIsSelecting(false)
  }, [])

  useGlobalMouseMove((event) => {
    if (isSelecting) {
      updateSelection(event)
    }
  }, [isSelecting, updateSelection])

  return (
    <div
      className='flex w-fit select-none text-content-200 text-xs font-bold cursor-text'
      ref={timelineRef}
      onMouseDown={onMouseDown}
    >
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
