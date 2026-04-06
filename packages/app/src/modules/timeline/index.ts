import { createAudioGraph } from '@audiograph'
import type { Program } from '@core'
import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLayout, useRegisterCommand } from '@editor'
import { useEffect, useRef, type FunctionComponent } from 'react'
import { useAudioEngine } from '../../components/contexts/AudioEngineContext.js'
import { useCompilationState } from '../../components/contexts/CompilationContext.js'
import { PlaybackControls } from './PlaybackControls.js'
import { TimelinePanel } from './TimelinePanel.js'

const moduleId = 'timeline' as ModuleId
export const timelinePanelId = `${moduleId}.timeline` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewTimelineId = `${moduleId}.view.timeline` as CommandId
const togglePlaybackId = `${moduleId}.playback.toggle` as CommandId

const Commands: FunctionComponent = () => {
  const [, layoutDispatch] = useLayout()

  const audioEngine = useAudioEngine()

  const { program } = useCompilationState()
  const programRef = useRef<Program | undefined>(program)

  useEffect(() => {
    programRef.current = program
  }, [program])

  useRegisterCommand(() => ({
    id: viewTimelineId,
    label: 'Show view: Timeline',
    run: () => {
      activateTabOfType(layoutDispatch, timelinePanelId)
    }
  }), [layoutDispatch])

  useRegisterCommand(() => ({
    id: togglePlaybackId,
    label: 'Playback: Toggle (play/stop)',
    keyboardShortcuts: [
      'Ctrl+Shift+Space'
    ],
    run: () => {
      const program = programRef.current

      if (audioEngine.playing.get()) {
        audioEngine.stop()
      } else if (program != null) {
        audioEngine.play(createAudioGraph(program))
      }
    }
  }), [])

  return null
}

export const timelineModule: Module = {
  id: moduleId,

  Commands,

  panels: [
    {
      id: timelinePanelId,
      closeable: true,
      Panel: TimelinePanel,
      Title: () => 'Timeline'
    }
  ],

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewTimelineId,
        label: 'Timeline'
      }
    ]
  },

  inserts: {
    header: [
      {
        position: 'start',
        Component: PlaybackControls
      }
    ]
  }
}
