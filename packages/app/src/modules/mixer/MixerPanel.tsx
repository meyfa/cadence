import { createEntityKey } from '@audiograph'
import type { Bus, Instrument, Program } from '@core'
import type { PanelProps } from '@editor'
import { useNonNullValue, useService } from '@editor'
import { Flowchart } from '@flowchart'
import type { GainMeasurement } from '@webaudio'
import clsx from 'clsx'
import type { CSSProperties, FunctionComponent, PropsWithChildren } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.js'
import { Popover } from '../../components/popover/Popover.js'
import { pluralize } from '../../utilities/format.js'
import type { MeteringService } from '../playback/services/metering.js'
import { METERING_SERVICE_ID } from '../playback/services/metering.js'
import type { MixerFlowchartOptions, MixerFlowNode } from './flowchart.js'
import { createMixerFlowchart } from './flowchart.js'

const FLOWCHART_OPTIONS: MixerFlowchartOptions = {
  nodeSize: {
    width: 160,
    height: 48
  },

  explicitEdgeStyle: {
    stroke: 'var(--color-frame-200)',
    strokeWidth: 2,
    strokeDasharray: undefined,
    markerEnd: 'arrow' as const
  },

  implicitEdgeStyle: {
    stroke: 'var(--color-frame-200)',
    strokeWidth: 2,
    strokeDasharray: '2 4',
    markerEnd: 'arrow' as const
  },

  highlightEdgeStyle: {
    stroke: 'var(--color-accent-200)',
    strokeWidth: 3
  }
}

const MISSING_ASSET_URL = '<missing asset>'

function getNodeTypeLabel (type: MixerFlowNode['data']['type']): string {
  switch (type) {
    case 'output':
      return 'Output'
    case 'bus':
      return 'Bus'
    case 'instrument':
      return 'Instrument'
  }
}

function getNodeLabel ({ data }: MixerFlowNode): string {
  switch (data.type) {
    case 'output':
      return 'Main Output'

    case 'bus':
      return data.object.name

    case 'instrument': {
      switch (data.object.source.type) {
        case 'sample': {
          const url = getSampleUrl(data.program, data.object)
          return url?.split('/').pop() ?? url ?? MISSING_ASSET_URL
        }

        case 'oscillator': {
          return data.object.source.shape
        }
      }
    }
  }
}

function getSampleUrl (program: Program, instrument: Instrument): string | undefined {
  if (instrument.source.type !== 'sample') {
    return undefined
  }

  return program.assets.get(instrument.source.assetId)?.url
}

export const MixerPanel: FunctionComponent<PanelProps> = () => {
  const { result: { program: currentProgram } } = useCompilationState()
  const program = useNonNullValue(currentProgram)

  const flowchart = useMemo(() => {
    return program == null
      ? undefined
      : createMixerFlowchart(program, FLOWCHART_OPTIONS)
  }, [program])

  return (
    <div className='h-full text-content-300 relative flex flex-col overflow-none'>
      {flowchart == null && (
        <div className='p-4 text-content-100'>
          Graph not available. Check your program for errors.
        </div>
      )}

      {flowchart != null && (
        <>
          <div className='p-2 z-10 bg-surface-200 rounded-md flex gap-4 flex-wrap select-none shrink-0'>
            <LegendItem text='Source/destination'>
              <FlowchartNodeIcon />
            </LegendItem>
            <LegendItem text='Routing (explicit)'>
              <FlowchartEdgeIcon explicit={true} />
            </LegendItem>
            <LegendItem text='Routing (default)'>
              <FlowchartEdgeIcon explicit={false} />
            </LegendItem>
          </div>

          <div className='flex-1 overflow-auto'>
            <div className='w-fit p-4 select-none'>
              <Flowchart NodeComponent={MixerNode} {...flowchart} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const LegendItem: FunctionComponent<PropsWithChildren<{
  text: string
}>> = ({ text, children }) => {
  return (
    <div className='flex items-center gap-2 text-sm'>
      <div className='w-6 h-4 flex items-center justify-center'>
        {children}
      </div>
      {text}
    </div>
  )
}

const FlowchartNodeIcon: FunctionComponent = () => {
  const style: CSSProperties = {
    stroke: 'var(--color-frame-200)',
    strokeWidth: 1,
    fill: 'var(--color-surface-200)'
  }

  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
      <rect x='1' y='1' width='22' height='14' rx='4' ry='4' style={style} />
    </svg>
  )
}

const FlowchartEdgeIcon: FunctionComponent<{
  explicit: boolean
}> = ({ explicit }) => {
  const style = FLOWCHART_OPTIONS[explicit ? 'explicitEdgeStyle' : 'implicitEdgeStyle']

  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 16'>
      <line x1='1' y1='7' x2='23' y2='7' style={style} />
    </svg>
  )
}

const MixerNode: FunctionComponent<{
  node: MixerFlowNode
  highlight?: boolean
}> = ({ node, highlight }) => {
  // must be reactive, so no ref
  const [container, setContainer] = useState<HTMLElement | null>(null)

  const [popover, setPopover] = useState<boolean>(false)
  const openPopover = useCallback(() => setPopover(true), [])
  const closePopover = useCallback(() => setPopover(false), [])

  const [measurement, setMeasurement] = useState<GainMeasurement>({ peak: [0, 0], rms: [0, 0] })

  const meteringService = useService<MeteringService>(METERING_SERVICE_ID)

  const entityKey = useMemo(() => {
    switch (node.data.type) {
      case 'output':
        return createEntityKey({ type: node.data.type })
      case 'bus':
        return createEntityKey({ type: node.data.type, id: node.data.object.id })
      case 'instrument':
        return createEntityKey({ type: node.data.type, id: node.data.object.id })
    }
  }, [node.data])

  useEffect(() => {
    return meteringService?.subscribeToGain(entityKey, setMeasurement)
  }, [meteringService, entityKey])

  const { peak, rms } = measurement

  return (
    <>
      <button
        type='button'
        className={clsx(
          'w-full h-full px-2 py-1 flex leading-snug text-sm rounded-md border cursor-pointer',
          highlight ? 'bg-surface-300 border-accent-200 ring-1 ring-accent-200' : 'bg-surface-200 border-frame-200'
        )}
        ref={setContainer}
        onClick={openPopover}
      >
        {/* vertical stereo peak/RMS meters */}
        <svg className='w-3.5 h-full mr-2 shrink-0'>
          <rect x='0' y='0' width='6' height='100%' fill='var(--color-surface-100)' />
          <rect x='8' y='0' width='6' height='100%' fill='var(--color-surface-100)' />
          <rect x='0' y={(1 - rms[0]) * 100 + '%'} width='6' height={rms[0] * 100 + '%'} fill='var(--color-accent-100)' className='transition-all duration-100' />
          <rect x='8' y={(1 - rms[1]) * 100 + '%'} width='6' height={rms[1] * 100 + '%'} fill='var(--color-accent-100)' className='transition-all duration-100' />
          <rect x='0' y={(1 - peak[0]) * 100 + '%'} width='6' height='2' fill={peak[0] > 1 ? 'var(--color-error-surface)' : 'var(--color-content-300)'} />
          <rect x='8' y={(1 - peak[1]) * 100 + '%'} width='6' height='2' fill={peak[1] > 1 ? 'var(--color-error-surface)' : 'var(--color-content-300)'} />
        </svg>
        {/* node info */}
        <div className='grow min-w-0 flex flex-col justify-center text-start'>
          <div className='text-content-100'>
            {getNodeTypeLabel(node.data.type)}
          </div>
          <div className='text-content-300 whitespace-nowrap text-ellipsis overflow-hidden'>
            {getNodeLabel(node)}
          </div>
        </div>
      </button>

      {popover && (
        <Popover anchor={container} onClose={closePopover}>
          {node.data.type === 'output' && (<OutputNodeInfo />)}
          {node.data.type === 'bus' && (<BusNodeInfo object={node.data.object} />)}
          {node.data.type === 'instrument' && (<InstrumentNodeInfo object={node.data.object} program={node.data.program} />)}
        </Popover>
      )}
    </>
  )
}

const OutputNodeInfo: FunctionComponent = () => {
  return (
    <div className='font-bold'>(Output)</div>
  )
}

const BusNodeInfo: FunctionComponent<{
  object: Bus
}> = ({ object }) => {
  return (
    <>
      <div className='font-bold'>bus.{object.name}</div>
      <div>gain: {object.gain.initial.value.toFixed(2)} {object.gain.initial.unit}</div>
      <div>pan: {object.pan.initial.value.toFixed(2)}</div>
      {object.effects.length > 0 && (
        <div>+ {pluralize(object.effects.length, 'effect')}</div>
      )}
    </>
  )
}

const InstrumentNodeInfo: FunctionComponent<{
  object: Instrument
  program: Program
}> = ({ object, program }) => {
  const sampleUrl = getSampleUrl(program, object) ?? MISSING_ASSET_URL

  return (
    <>
      <div className='font-bold'>(Instrument)</div>
      <div>type: {object.source.type}</div>
      {object.source.type === 'sample' && (
        <div className='max-w-96'>url: {sampleUrl}</div>
      )}
      {object.source.type === 'oscillator' && (
        <div>shape: {object.source.shape}</div>
      )}
      <div>root_note: {object.rootNote ?? 'undefined'}</div>
      <div>gain: {object.gain.initial.value.toFixed(2)} {object.gain.initial.unit}</div>
    </>
  )
}
