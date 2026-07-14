import type { AudioGraphOptions } from '@meyfa/cadence-audiograph'
import { createAudioGraph } from '@meyfa/cadence-audiograph'
import type { CommandId, MenuSectionId, Module, ModuleId, PanelId, Problem } from '@meyfa/cadence-editor'
import { activateTabOfType, useLatestRef, useLayoutDispatch, useNotificationService, useObservable, useProvideProblems, useRegisterCommand, useRegisterService } from '@meyfa/cadence-editor'
import type { Numeric } from '@meyfa/cadence-utility'
import type { FunctionComponent } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.tsx'
import { Notification } from '../../components/notification/Notification.tsx'
import { OutputGainSettingsCard } from './components/OutputGainSettingsCard.tsx'
import { PlaybackControls } from './components/PlaybackControls.tsx'
import { TimelinePanel } from './components/TimelinePanel.tsx'
import { usePlaybackSettingsSync } from './persistence.ts'
import { PlaybackProvider, useAudioEngine } from './provider.tsx'
import { METERING_SERVICE_ID, MeteringService } from './services/metering.ts'

const PLAYBACK_ERROR_MESSAGE = 'Cannot play: Program contains errors.'
const PLAYBACK_ERROR_TIMEOUT = 5 as Numeric<'s'>

const AUDIO_GRAPH_OPTIONS: AudioGraphOptions = {
  metering: {
    interval: 0.1 as Numeric<'s'>
  }
}

const moduleId = 'playback' as ModuleId
export const timelinePanelId = `${moduleId}.timeline` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewTimelineId = `${moduleId}.view.timeline` as CommandId
const togglePlaybackId = `${moduleId}.toggle` as CommandId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()
  const { showNotification } = useNotificationService()

  usePlaybackSettingsSync()

  const compilation = useCompilationState()
  const compilationRef = useLatestRef(compilation)

  const [graphErrors, setGraphErrors] = useState<readonly Error[]>([])

  const audioEngine = useAudioEngine()
  const engineErrors = useObservable(audioEngine.errors)

  const problems = useMemo(() => {
    return [...engineErrors, ...graphErrors].map((error): Problem => ({
      kind: 'error',
      label: 'Playback',
      message: error.message,
      error
    }))
  }, [engineErrors, graphErrors])

  const showErrorNotification = useCallback(() => {
    showNotification(Notification, { severity: 'error', message: PLAYBACK_ERROR_MESSAGE }, {
      kind: `${moduleId}.playback.error`,
      timeout: PLAYBACK_ERROR_TIMEOUT
    })
  }, [showNotification])

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
        showErrorNotification()
        return
      }

      try {
        audioEngine.play(createAudioGraph(program, AUDIO_GRAPH_OPTIONS))
        setGraphErrors([])
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        const error = new Error(`Failed to create audio graph: ${message}`, {
          cause: err instanceof Error ? err : undefined
        })

        setGraphErrors([error])
        showErrorNotification()

        // An error here is unexpected. Rethrow to make it available in the console.
        throw error
      }
    }
  }), [audioEngine, showErrorNotification])

  useProvideProblems(problems)

  useRegisterService<MeteringService>(METERING_SERVICE_ID, {
    subscribeToGain: (key, observer) => {
      return audioEngine.meters.subscribeToGain(key, observer)
    }
  }, [audioEngine])

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
