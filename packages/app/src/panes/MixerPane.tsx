import { createMixerFlowchart, type MixerFlowchartOptions, type MixerFlowNode } from '@editor/mixer/flowchart.js'
import { Flowchart } from '@flowchart/index.js'
import clsx from 'clsx'
import { useCallback, useMemo, type CSSProperties, type FunctionComponent, type PropsWithChildren } from 'react'
import { usePrevious } from '../hooks/previous.js'
import { useCompilationState } from '../state/CompilationContext.js'

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
  }
}

function getNodeLabel ({ data }: MixerFlowNode): string {
  switch (data.type) {
    case 'Output':
      return 'Main Output'
    case 'Bus':
      return data.object.name
    case 'Instrument': {
      return data.object.sampleUrl.split('/').pop() ?? data.object.sampleUrl
    }
  }
}

export const MixerPane: FunctionComponent = () => {
  const { program: currentProgram } = useCompilationState()
  const program = usePrevious(currentProgram)

  const flowchart = useMemo(() => {
    return program == null
      ? undefined
      : createMixerFlowchart(program, FLOWCHART_OPTIONS)
  }, [program])

  const renderNode = useCallback((node: MixerFlowNode) => {
    return (
      <div
        className={clsx(
          'w-full h-full',
          'bg-surface-200 border border-frame-200 rounded-md',
          'px-2 py-1 flex flex-col justify-center leading-snug text-sm'
        )}
      >
        <div className='text-content-100'>
          {node.data.type}
        </div>
        <div className='text-content-300 whitespace-nowrap text-ellipsis overflow-hidden'>
          {getNodeLabel(node)}
        </div>
      </div>
    )
  }, [])

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
              <Flowchart renderNode={renderNode} {...flowchart} />
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
