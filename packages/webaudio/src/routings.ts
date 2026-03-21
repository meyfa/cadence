import type { BusId, InstrumentId, MixerRouting, Program } from '@core/program.js'
import type { Instance } from './nodes/types.js'
import type { Transport } from './transport.js'

export function setupRoutings (
  transport: Transport,
  program: Program,
  instruments: ReadonlyMap<InstrumentId, Instance>,
  buses: ReadonlyMap<BusId, Instance>
): void {
  const mainOutput = createMainOutput(transport)

  const findSource = (item: MixerRouting['source']): Instance | undefined => {
    switch (item.type) {
      case 'Bus':
        return buses.get(item.id)
      case 'Instrument':
        return instruments.get(item.id)
    }
  }

  const findDestination = (item: MixerRouting['destination']): Instance | undefined => {
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
    if (source?.output != null && destination?.input != null) {
      source.output.connect(destination.input)
    }
  }
}

function createMainOutput (transport: Transport): Instance {
  return {
    loaded: Promise.resolve(),
    dispose: () => {},
    input: transport.output,
    triggerNote: () => {}
  }
}
