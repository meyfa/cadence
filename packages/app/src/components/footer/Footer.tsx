import { type FunctionComponent, type PropsWithChildren } from 'react'
import { useCommandDispatcher } from '../../commands/dispatcher.js'
import { modules } from '../../modules/index.js'
import type { AppModuleInsert } from '../../modules/types.js'

const allInserts: readonly AppModuleInsert[] = modules.flatMap((module) => module.inserts?.footer ?? [])

const insertsByPosition: Record<AppModuleInsert['position'], readonly AppModuleInsert[]> = {
  start: allInserts.filter((insert) => insert.position === 'start'),
  end: allInserts.filter((insert) => insert.position === 'end')
}

export const Footer: FunctionComponent = () => {
  const { dispatchCommandById } = useCommandDispatcher()

  return (
    <footer className='flex h-6 px-2 gap-2 items-center text-sm bg-surface-200 text-content-200 border-t border-t-frame-100 select-none'>
      {insertsByPosition.start.map(({ commandId, Label }) => (
        <FooterButton key={commandId} onClick={() => dispatchCommandById(commandId)}>
          <Label />
        </FooterButton>
      ))}

      <div className='flex-1' />

      {insertsByPosition.end.map(({ commandId, Label }) => (
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
