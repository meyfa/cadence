import { createAudioGraph } from '@audiograph'
import type { Module, ModuleId, PanelId, Command, CommandId, MenuSectionId } from '@editor'
import { activateTabOfType } from '@editor'
import type { CommandContext } from '../../commands.js'
import { PlaybackControls } from './PlaybackControls.js'
import { TimelinePanel } from './TimelinePanel.js'

const moduleId = 'timeline' as ModuleId
export const timelinePanelId = `${moduleId}.timeline` as PanelId

const viewShowSectionId = 'view.show' as MenuSectionId

const viewTimeline: Command<CommandContext> = {
  id: `${moduleId}.view.timeline` as CommandId,
  label: 'Show view: Timeline',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, timelinePanelId)
  }
}

const togglePlayback: Command<CommandContext> = {
  id: `${moduleId}.playback.toggle` as CommandId,
  label: 'Playback: Toggle (play/stop)',
  keyboardShortcuts: [
    'Ctrl+Shift+Space'
  ],
  action: ({ audioEngine, lastProgram }) => {
    if (audioEngine.playing.get()) {
      audioEngine.stop()
    } else if (lastProgram != null) {
      audioEngine.play(createAudioGraph(lastProgram))
    }
  }
}

export const timelineModule: Module<CommandContext> = {
  id: moduleId,

  panels: [
    {
      id: timelinePanelId,
      closeable: true,
      Panel: TimelinePanel,
      Title: () => 'Timeline'
    }
  ],

  commands: [
    viewTimeline,
    togglePlayback
  ],

  menu: {
    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewTimeline.id,
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
