import { useModules, type FooterInsert } from '@editor'
import { useMemo, type FunctionComponent, type PropsWithChildren } from 'react'
import { useTypedCommandDispatch } from '../../commands.js'

export const Footer: FunctionComponent = () => {
  const { dispatchCommandById } = useTypedCommandDispatch()
  const inserts = useInsertsByPosition()

  return (
    <footer className='flex h-6 px-2 gap-2 items-center text-sm bg-surface-200 text-content-200 border-t border-t-frame-100 select-none'>
      {inserts.start.map(({ commandId, Label }) => (
        <FooterButton key={commandId} onClick={() => dispatchCommandById(commandId)}>
          <Label />
        </FooterButton>
      ))}

      <div className='flex-1' />

      {inserts.end.map(({ commandId, Label }) => (
        <FooterButton key={commandId} onClick={() => dispatchCommandById(commandId)}>
          <Label />
        </FooterButton>
      ))}
    </footer>
  )
}

const FooterButton: FunctionComponent<PropsWithChildren<{
  onClick?: () => void
}>> = ({ onClick, children }) => {
  return (
    <button
      type='button'
      className='px-2 h-full enabled:cursor-pointer enabled:hocus:bg-surface-300 enabled:hocus:text-content-300'
      onClick={onClick}
      disabled={onClick == null}
    >
      {children}
    </button>
  )
}

function useInsertsByPosition (): Record<FooterInsert['position'], readonly FooterInsert[]> {
  const modules = useModules()

  return useMemo(() => {
    const allInserts = modules.flatMap((module) => module.inserts?.footer ?? [])
    return {
      start: allInserts.filter((insert) => insert.position === 'start'),
      end: allInserts.filter((insert) => insert.position === 'end')
    }
  }, [modules])
}
