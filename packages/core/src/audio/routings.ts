import type { BusId, InstrumentId, MixerRouting, Program } from '@core/program.js'
import type { BusInstance, InputMixin, InstrumentInstance, OutputMixin } from './instances.js'

export function setupRoutings (
  program: Program,
  instruments: ReadonlyMap<InstrumentId, InstrumentInstance>,
  buses: ReadonlyMap<BusId, BusInstance>
): void {
  const getSource = (item: MixerRouting['source']): OutputMixin | undefined => {
    switch (item.type) {
      case 'Bus':
        return buses.get(item.id)
      case 'Instrument':
        return instruments.get(item.id)
    }
  }

  const getDestination = (item: MixerRouting['destination']): InputMixin | undefined => {
    return buses.get(item.id)
  }

  for (const routing of program.mixer.routings) {
    const source = getSource(routing.source)
    const destination = getDestination(routing.destination)
    if (source != null && destination != null) {
      source.output.connect(destination.input)
    }
  }

  for (const id of getUnroutedBusIds(program)) {
    buses.get(id)?.output.toDestination()
  }

  for (const id of getUnroutedInstrumentIds(program)) {
    instruments.get(id)?.output.toDestination()
  }
}

function getUnroutedBusIds (program: Program): ReadonlySet<BusId> {
  const unrouted = new Set(program.mixer.buses.map((bus) => bus.id))

  for (const routing of program.mixer.routings) {
    if (routing.source.type === 'Bus') {
      unrouted.delete(routing.source.id)
    }
  }

  return unrouted
}

function getUnroutedInstrumentIds (program: Program): ReadonlySet<InstrumentId> {
  const unrouted = new Set(program.instruments.keys())

  for (const routing of program.mixer.routings) {
    if (routing.source.type === 'Instrument') {
      unrouted.delete(routing.source.id)
    }
  }

  return unrouted
}
