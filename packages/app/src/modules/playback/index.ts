import { createAudioGraph } from '@audiograph'
import type { Program } from '@core'
import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLayoutDispatch, useNotificationService, useProvideProblems, useRegisterCommand } from '@editor'
import { numeric } from '@utility'
import { useEffect, useRef, type FunctionComponent } from 'react'
import { useAudioEngine } from '../../components/contexts/AudioEngineContext.js'
import { useCompilationState } from '../../components/contexts/CompilationContext.js'
import { Notification } from '../../components/notification/Notification.js'
import { useObservable } from '../../hooks/observable.js'
import { OutputGainSettingsCard } from './OutputGainSettingsCard.js'
import { usePlaybackSettingsSync } from './persistence.js'
import { PlaybackControls } from './PlaybackControls.js'
import { TimelinePanel } from './TimelinePanel.js'

const PLAYBACK_ERROR_MESSAGE = 'Cannot play: Program contains errors.'
const PLAYBACK_ERROR_TIMEOUT = numeric('s', 5)

const moduleId = 'playback' as ModuleId
export const timelinePanelId = `${moduleId}.timeline` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewTimelineId = `${moduleId}.view.timeline` as CommandId
const togglePlaybackId = `${moduleId}.toggle` as CommandId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()
  const { showNotification } = useNotificationService()
  usePlaybackSettingsSync()

  const audioEngine = useAudioEngine()
  const errors = useObservable(audioEngine.errors)

  const { program } = useCompilationState()
  const programRef = useRef<Program | undefined>(program)

  useEffect(() => {
    programRef.current = program
  }, [program])

  useRegisterCommand(() => ({
    id: viewTimelineId,
    label: 'Show view: Timeline',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, timelinePanelId))
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
        return
      }

      if (program == null) {
        showNotification(Notification, {
          severity: 'error',
          message: PLAYBACK_ERROR_MESSAGE
        }, {
          kind: `${moduleId}.playback.error`,
          timeout: PLAYBACK_ERROR_TIMEOUT
        })
        return
      }

      audioEngine.play(createAudioGraph(program))
    }
  }), [])

  useProvideProblems(moduleId, 'Playback', errors)

  return null
}

export const playbackModule: Module = {
  id: moduleId,

  GlobalHooks,

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

  settings: {
    cards: [
      OutputGainSettingsCard
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
