import type { BusId, InstrumentId, MixerRouting, Program } from '@core/program.js'
import { getDestination } from 'tone'
import type { BusInstance, InputMixin, InstrumentInstance, OutputMixin } from './instances.js'

const mainOutput: InputMixin = {
  input: getDestination()
}

export function setupRoutings (
  program: Program,
  instruments: ReadonlyMap<InstrumentId, InstrumentInstance>,
  buses: ReadonlyMap<BusId, BusInstance>
): void {
  const findSource = (item: MixerRouting['source']): OutputMixin | undefined => {
    switch (item.type) {
      case 'Bus':
        return buses.get(item.id)
      case 'Instrument':
        return instruments.get(item.id)
    }
  }

  const findDestination = (item: MixerRouting['destination']): InputMixin | undefined => {
    switch (item.type) {
      case 'Output':
        return mainOutput
      case 'Bus':
        return buses.get(item.id)
    }
  }

  for (const routing of program.mixer.routings) {
    const source = findSource(routing.source)
    const destination = findDestination(routing.destination)
    if (source != null && destination != null) {
      source.output.connect(destination.input)
    }
  }
}
