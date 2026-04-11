import { createAudioGraph } from '@audiograph'
import type { CommandId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useLatestRef, useLayoutDispatch, useNotificationService, useObservable, useProvideProblems, useRegisterCommand } from '@editor'
import { numeric } from '@utility'
import { type FunctionComponent } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.js'
import { Notification } from '../../components/notification/Notification.js'
import { OutputGainSettingsCard } from './components/OutputGainSettingsCard.js'
import { PlaybackControls } from './components/PlaybackControls.js'
import { TimelinePanel } from './components/TimelinePanel.js'
import { usePlaybackSettingsSync } from './persistence.js'
import { PlaybackProvider, useAudioEngine } from './provider.js'

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

  const compilation = useCompilationState()
  const compilationRef = useLatestRef(compilation)

  useRegisterCommand(() => ({
    id: viewTimelineId,
    label: 'Show view: Timeline',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, timelinePanelId, () => ({ type: timelinePanelId })))
    }
  }), [layoutDispatch])

  useRegisterCommand(() => ({
    id: togglePlaybackId,
    label: 'Playback: Toggle (play/stop)',
    keyboardShortcuts: [
      'Ctrl+Shift+Space'
    ],
    run: () => {
      const { loading, result, compileNow } = compilationRef.current
      const { program } = loading ? compileNow() : result

      if (audioEngine.playing.get()) {
        audioEngine.stop()
        return
      }

      if (program == null) {
        showNotification(Notification, { severity: 'error', message: PLAYBACK_ERROR_MESSAGE }, {
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

  Provider: PlaybackProvider,

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
