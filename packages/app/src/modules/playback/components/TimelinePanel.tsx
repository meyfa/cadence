import type { BeatRange } from '@core'
import type { PanelProps } from '@editor'
import { useObservable, useNonNullValue } from '@editor'
import { useCallback, type FunctionComponent } from 'react'
import { useCompilationState } from '../../../compilation/CompilationContext.js'
import { Timeline } from '../../../components/timeline/Timeline.js'
import { useAudioEngine } from '../provider.js'

export const TimelinePanel: FunctionComponent<PanelProps> = () => {
  const { result: { program: currentProgram } } = useCompilationState()
  const program = useNonNullValue(currentProgram)

  const engine = useAudioEngine()

  const range = useObservable(engine.range)
  const setRange = useCallback((range: BeatRange) => engine.range.set(range), [engine])

  const playing = useObservable(engine.playing)
  const position = useObservable(engine.position)

  return (
    <div className='h-full overflow-auto overflow-x-scroll'>
      {program == null && (
        <div className='p-4 text-content-100'>
          Timeline not available. Check your program for errors.
        </div>
      )}

      {program != null && (
        <Timeline
          program={program}
          selection={range}
          setSelection={setRange}
          playbackPosition={playing ? position : undefined}
        />
      )}
    </div>
  )
}
