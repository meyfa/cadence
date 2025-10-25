import type { Program, Section } from '@core/program.js'
import clsx from 'clsx'
import { useCallback, useMemo, useState, type FunctionComponent } from 'react'
import { formatStepDuration } from '../utilities/strings.js'

const TIMELINE_ZOOM_MIN = 4
const TIMELINE_ZOOM_MAX = 64
const TIMELINE_ZOOM_DEFAULT = 16

const TIMELINE_ZOOM_STEP = 2

const TIMELINE_TRANSITION_DURATION = '100ms'
const TIMELINE_TRANSITION_EASING = 'ease'

export const Timeline: FunctionComponent<{
  program: Program
  playbackProgress?: number
}> = ({ program, playbackProgress }) => {
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

        {playbackProgress != null && (
          <div
            className='absolute top-0 bottom-0 w-0.5 bg-accent-400 pointer-events-none'
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
}> = ({ beatsPerBar, stepsPerBeat, totalStepCount, beatWidth }) => {
  const totalBeats = Math.ceil(totalStepCount / stepsPerBeat)

  const marks = useMemo<readonly number[]>(() => {
    const result: number[] = []

    for (let beat = 0; beat < totalBeats; ++beat) {
      result.push(beat % beatsPerBar)
    }

    return result
  }, [beatsPerBar, stepsPerBeat, totalBeats])

  return (
    <div className='flex w-fit select-none text-content-200 text-xs font-bold'>
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
        'px-2 py-1 text-sm leading-tight text-nowrap overflow-hidden text-ellipsis',
        'rounded-md bg-surface-200 border border-frame-200 text-content-200'
      )}
      style={{
        width: sectionWidth,
        transition: `width ${TIMELINE_TRANSITION_DURATION} ${TIMELINE_TRANSITION_EASING}`
      }}
    >
      {section.name}

      <div className='text-content-100 select-none'>
        {lengthString}
      </div>
    </div>
  )
}
