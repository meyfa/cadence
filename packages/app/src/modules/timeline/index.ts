import { createAudioGraph } from '@audiograph'
import { activateTabOfType } from '@editor'
import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { TimelinePanel } from './TimelinePanel.js'

const moduleId = 'timeline' as AppModuleId
export const timelinePanelId = `${moduleId}.timeline` as AppModulePanelId

const viewTimeline: Command = {
  id: `${moduleId}.view.timeline` as CommandId,
  label: 'Show view: Timeline',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, timelinePanelId)
  }
}

const togglePlayback: Command = {
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

export const timelineModule: AppModule = {
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

  menuItems: [
    {
      menuSectionId: MenuSectionIds.ViewShow,
      commandId: viewTimeline.id,
      label: 'Timeline'
    }
  ]
}
