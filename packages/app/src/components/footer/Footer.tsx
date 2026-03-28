import type { FunctionComponent, PropsWithChildren } from 'react'
import { useCommandRegistry } from '../../commands/registry.js'
import { modules } from '../../modules/index.js'
import type { FooterInsert } from '../../modules/types.js'

const allInserts: readonly FooterInsert[] = modules.flatMap((module) => module.inserts?.footer ?? [])

const insertsByPosition: Record<FooterInsert['position'], readonly FooterInsert[]> = {
  start: allInserts.filter((insert) => insert.position === 'start'),
  end: allInserts.filter((insert) => insert.position === 'end')
}

export const Footer: FunctionComponent = () => {
  const { dispatchCommandById } = useCommandRegistry()

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
