import type { StepRange } from '@core/audio/types.js'
import { useCallback, type FunctionComponent } from 'react'
import { Timeline } from '../components/Timeline.js'
import { useObservable } from '../hooks/observable.js'
import { usePrevious } from '../hooks/previous.js'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import { useCompilationState } from '../state/CompilationContext.js'

export const TimelinePane: FunctionComponent = () => {
  const { program: currentProgram } = useCompilationState()
  const program = usePrevious(currentProgram)

  const engine = useAudioEngine()

  const range = useObservable(engine.range)
  const setRange = useCallback((range: StepRange) => engine.range.set(range), [engine])

  const playing = useObservable(engine.playing)
  const progress = useObservable(engine.progress)

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
          playbackProgress={playing ? progress : undefined}
        />
      )}
    </div>
  )
}
