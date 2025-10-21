import { type Program } from '@core/program.js'
import clsx from 'clsx'
import { useMemo, type FunctionComponent } from 'react'
import { Footer } from '../components/Footer.js'
import { Timeline } from '../components/Timeline.js'
import { formatDuration, formatStepDuration } from '../utilities/strings.js'

export const TimelinePage: FunctionComponent<{
  program: Program | undefined
  playbackProgress?: number
}> = ({ program, playbackProgress }) => {
  const totalStepCount = program?.track.sections.reduce((sum, section) => sum + section.length.value, 0) ?? 0

  const lengthString = useMemo(() => {
    if (program == null) {
      return ''
    }

    return formatStepDuration(totalStepCount, {
      beatsPerBar: program.beatsPerBar,
      stepsPerBeat: program.stepsPerBeat
    })
  }, [program, totalStepCount])

  const runningTime = useMemo(() => {
    if (program == null) {
      return ''
    }

    const stepDurationInSeconds = 60 / (program.track.tempo.value * program.stepsPerBeat)
    const totalSeconds = totalStepCount * stepDurationInSeconds

    return formatDuration(totalSeconds)
  }, [program, totalStepCount])

  return (
    <div className='h-full flex flex-col'>
      <div className='flex-1 min-h-0 overflow-none text-white relative'>
        {program == null && (
          <div className='p-4'>
            <div className='text-xl mb-4'>
              Timeline not available
            </div>

            Check your program for errors.
          </div>
        )}

        {program != null && (
          <Timeline program={program} playbackProgress={playbackProgress} />
        )}
      </div>

      <Footer>
        <div className={clsx('flex-1', program == null && 'text-rose-400')}>
          {program != null && (
            <div>
              Track length: {lengthString} / {runningTime}
            </div>
          )}
          {program == null && (
            <div>
              Program not available
            </div>
          )}
        </div>
      </Footer>
    </div>
  )
}
