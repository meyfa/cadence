import type { InstrumentNode, SourceNode } from '@audiograph'
import type { NoteEvent } from '@core'
import { timeToSeconds } from '@core'
import type { Numeric } from '@utility'
import type { Transport } from '../../transport/transport.js'
import { applyAutomationPoints } from '../automation.js'
import type { Assets } from '../factory.js'
import type { Instance } from '../instance.js'
import { createOscillatorSource } from './oscillator.js'
import { createSampleSource } from './sample.js'

export function createInstrumentInstance (
  node: InstrumentNode,
  transport: Transport,
  assets: Assets
): Instance {
  const { ctx } = transport

  const sources = new Set<ActiveSource>()
  const output = ctx.createGain()

  const dispose: Instance['dispose'] = () => {
    output.disconnect()
    for (const source of sources) {
      disposeActiveSource(source)
    }
  }

  const scheduleAtNote = (note: NoteEvent, tempo: Numeric<'bpm'>, callback: (time: number) => void) => {
    const time = timeToSeconds(note.time, tempo).value
    transport.schedule(time, callback)
  }

  const triggerNote: Instance['triggerNote'] = (note, tempo) => scheduleAtNote(note, tempo, (time) => {
    if (time < 0) {
      return
    }

    for (const source of node.trigger(note)) {
      const sourceNode = createSourceNode(source, transport, assets)
      const gainNode = ctx.createGain()

      sourceNode.connect(gainNode).connect(output)

      applyAutomationPoints(time, transport, gainNode.gain, source.gainCurve)

      const activeSource: ActiveSource = {
        sourceNode,
        gainNode,
        disposed: false
      }
      sources.add(activeSource)

      sourceNode.start(time)

      if (source.duration != null) {
        sourceNode.stop(time + source.duration)
      }

      sourceNode.addEventListener('ended', () => {
        if (!activeSource.disposed) {
          sources.delete(activeSource)
          disposeActiveSource(activeSource)
        }
      }, { once: true })
    }
  })

  return { dispose, output, triggerNote }
}

interface ActiveSource {
  readonly sourceNode: AudioScheduledSourceNode
  readonly gainNode: GainNode
  disposed: boolean
}

function disposeActiveSource (source: ActiveSource): void {
  if (!source.disposed) {
    source.disposed = true
    source.sourceNode.stop()
    source.sourceNode.disconnect()
    source.gainNode.disconnect()
  }
}

function createSourceNode (node: SourceNode, transport: Transport, assets: Assets): AudioScheduledSourceNode {
  switch (node.type) {
    case 'sample':
      return createSampleSource(node, transport, assets)

    case 'oscillator':
      return createOscillatorSource(node, transport)
  }
}
