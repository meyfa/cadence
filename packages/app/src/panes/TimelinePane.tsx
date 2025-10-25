import { type Program } from '@core/program.js'
import { type FunctionComponent } from 'react'
import { Timeline } from '../components/Timeline.js'

export const TimelinePane: FunctionComponent<{
  program: Program | undefined
  playbackProgress?: number
}> = ({ program, playbackProgress }) => {
  return (
    <div className='h-full overflow-auto overflow-x-scroll'>
      {program == null && (
        <div className='p-4 text-neutral-300'>
          Timeline not available. Check your program for errors.
        </div>
      )}

      {program != null && (
        <Timeline program={program} playbackProgress={playbackProgress} />
      )}
    </div>
  )
}
