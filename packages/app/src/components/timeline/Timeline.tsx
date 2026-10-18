import type { Part, Program } from '@meyfa/cadence-core'
import { calculateTotalLength } from '@meyfa/cadence-core'
import { useGlobalMouseMove, useGlobalMouseUp } from '@meyfa/cadence-editor'
import type { Numeric, Observable } from '@meyfa/cadence-utility'
import type { BeatRange } from '@meyfa/cadence-webaudio'
import { WarningAmberSharp } from '@mui/icons-material'
import clsx from 'clsx'
import type { FunctionComponent } from 'react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatBeatDuration, formatBeatDurationAsWords } from '../../utilities/format.ts'
import { Popover } from '../popover/Popover.tsx'
import { TIMELINE_TRANSITION_DURATION, TIMELINE_TRANSITION_EASING, TIMELINE_ZOOM_DEFAULT, TIMELINE_ZOOM_MAX, TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_STEP } from './constants.ts'
import { getBeatFromPosition, useRuler } from './ruler.ts'

export const Timeline: FunctionComponent<{
  program: Program
  selection: BeatRange
  setSelection: (range: BeatRange) => void
  playbackActive: boolean
  playbackPosition: Observable<Numeric<'beats'>>
}> = ({ program, selection, setSelection, playbackActive, playbackPosition }) => {
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

  const isRangeSelection = selection.end != null && selection.end > selection.start
  const showSelection = trackLength > 0 && (isRangeSelection || selection.start > 0)

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
            dimmed={playbackActive}
          />
        )}

        {showSelection && selection.end != null && (
          <TimelineMarker
            variant='end'
            position={selection.end}
            trackLength={trackLength}
            dimmed={playbackActive}
          />
        )}

        <PlaybackCursor
          active={playbackActive}
          trackLength={trackLength}
          position={playbackPosition}
        />
      </div>
    </div>
  )
}

const PlaybackCursor: FunctionComponent<{
  active: boolean
  trackLength: Numeric<'beats'>
  position: Observable<Numeric<'beats'>>
}> = ({ active, trackLength, position }) => {
  // We use DOM refs to avoid React re-renders per position update.

  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    if (cursor == null) {
      return
    }

    if (!active || trackLength <= 0) {
      cursor.style.display = 'none'
      return
    }

    cursor.style.display = ''

    let frameHandle: number | undefined
    let latestPosition: Numeric<'beats'> | undefined

    const applyPosition = () => {
      frameHandle = undefined
      if (latestPosition == null) {
        return
      }

      const clampedPosition = Math.max(0, Math.min(latestPosition, trackLength))
      cursor.style.left = `${(clampedPosition / trackLength) * 100}%`
    }

    const unsubscribe = position.subscribe((position) => {
      latestPosition = position
      frameHandle ??= requestAnimationFrame(applyPosition)
    })

    return () => {
      unsubscribe()
      if (frameHandle != null) {
        cancelAnimationFrame(frameHandle)
      }
    }
  }, [active, trackLength, position])

  return (
    <div
      ref={cursorRef}
      className='absolute top-0 bottom-0 w-1 -ml-0.5 bg-accent-100 pointer-events-none'
      style={{ display: 'none' }}
    />
  )
}

const TimeRuler: FunctionComponent<{
  beatsPerBar: number
  trackLength: Numeric<'beats'>
  beatWidth: number
  selection: BeatRange
  onSelect: (range: BeatRange) => void
}> = ({ beatsPerBar, trackLength, beatWidth, selection, onSelect }) => {
  const timelineRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<Numeric<'beats'> | undefined>(undefined)

  const totalBeats = Math.ceil(trackLength)

  const { limited, majorTickPath, minorTickPath, barLabelBeats } = useRuler({
    beatsPerBar,
    totalBeats,
    beatWidth
  })

  const computeTimeFromEvent = useCallback((event: MouseEvent | React.MouseEvent): Numeric<'beats'> | undefined => {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (rect == null || beatWidth <= 0) {
      return undefined
    }

    return getBeatFromPosition({
      positionInPixels: event.clientX - rect.left,
      beatsPerBar,
      // Prevent selection beyond the track length.
      totalBeats: trackLength,
      beatWidth
    })
  }, [beatsPerBar, trackLength, beatWidth])

  const updateSelection = useCallback((event: MouseEvent | React.MouseEvent) => {
    const position = computeTimeFromEvent(event)
    if (position == null || selectionStart == null) {
      return
    }

    if (selectionStart === position) {
      onSelect({ start: position })
      return
    }

    onSelect({
      start: position < selectionStart ? position : selectionStart,
      end: position >= selectionStart ? position : selectionStart
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
  })

  useGlobalMouseMove((event) => {
    if (isSelecting) {
      updateSelection(event)
    }
  })

  return (
    <div
      className='relative flex w-fit select-none text-content-200 text-xs font-bold cursor-text'
      ref={timelineRef}
      onMouseDown={onMouseDown}
    >
      {trackLength > 0 && selection.end != null && (
        <div
          className='absolute top-0 h-[calc(100%+0.5rem)] bg-accent-100 opacity-40 pointer-events-none -z-10'
          style={{
            left: `${(selection.start / trackLength) * 100}%`,
            width: `${((selection.end - selection.start) / trackLength) * 100}%`
          }}
        />
      )}

      <svg
        className='block'
        style={{
          width: totalBeats * beatWidth,
          height: 16,
          transition: `width ${TIMELINE_TRANSITION_DURATION} ${TIMELINE_TRANSITION_EASING}`
        }}
      >
        <path d={minorTickPath} stroke='currentColor' strokeWidth={1} />
        <path d={majorTickPath} stroke='currentColor' strokeWidth={1} />

        {barLabelBeats.map((beat) => (
          <RulerLabel
            key={beat}
            beat={beat}
            beatsPerBar={beatsPerBar}
            beatWidth={beatWidth}
          />
        ))}
      </svg>

      {limited && (<RenderingLimitExceededWarning />)}
    </div>
  )
}

const RulerLabel: FunctionComponent<{
  beat: number
  beatsPerBar: number
  beatWidth: number
}> = ({ beat, beatsPerBar, beatWidth }) => {
  return (
    <text
      x={beat * beatWidth + 4}
      y={12}
      style={{
        fill: 'currentColor',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'inherit'
      }}
    >
      {beat / beatsPerBar}
    </text>
  )
}

const RenderingLimitExceededWarning: FunctionComponent = () => {
  return (
    <div className='pointer-events-none absolute inset-0'>
      <div className='sticky top-0 left-0 z-10 inline-flex h-6 items-center px-2 text-sm text-content-100'>
        <WarningAmberSharp className='mr-1' fontSize='inherit' />
        Track exceeds rendering limit
      </div>
    </div>
  )
}

const TimelinePart: FunctionComponent<{
  part: Part
  beatsPerBar: number
  beatWidth: number
}> = ({ part, beatsPerBar, beatWidth }) => {
  const partWidth = part.length * beatWidth
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
        {part.label ?? '(no label)'}

        <div className='text-content-100'>
          {lengthShort}
        </div>
      </button>

      {popoverOpen && (
        <Popover anchor={container} onClose={closePopover}>
          <div className='font-bold'>{part.label ?? '(no label)'}</div>
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
        left: `${(position / trackLength) * 100}%`
      }}
    >
      <svg className='w-5 h-2.5 -ml-2.5' viewBox='0 0 16 8' fill='none' xmlns='http://www.w3.org/2000/svg'>
        <path d={markerPathData[variant]} fill='currentColor' />
      </svg>
      <div className='absolute top-0 bg-current h-full w-0.5 -left-px' />
    </div>
  )
}
