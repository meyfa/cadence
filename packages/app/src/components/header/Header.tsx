import { useModules, type HeaderInsert } from '@editor'
import { useMemo, type FunctionComponent, type ReactNode } from 'react'
import { MainMenu } from '../commands/MainMenu.js'

export const Header: FunctionComponent<{
  readonly logo?: ReactNode
}> = ({ logo }) => {
  const inserts = useInsertsByPosition()

  return (
    <header className='grid grid-cols-2 md:grid-cols-3 items-center px-2 py-1 gap-1 bg-surface-200 border-b border-b-frame-200'>
      <div className='flex items-center gap-1 h-full'>
        {logo && (
          <div className='mr-1 shrink-0'>
            {logo}
          </div>
        )}

        <MainMenu />

        {inserts.start.map(({ Component }, index) => (
          <Component key={index} />
        ))}
      </div>

      <div className='flex justify-center'>
        {inserts.middle.map(({ Component }, index) => (
          <Component key={index} />
        ))}
      </div>

      <div className='hidden md:block' />
    </header>
  )
}

function useInsertsByPosition (): Record<HeaderInsert['position'], readonly HeaderInsert[]> {
  const modules = useModules()

  return useMemo(() => {
    const allInserts = modules.flatMap((module) => module.inserts?.header ?? [])
    return {
      start: allInserts.filter((insert) => insert.position === 'start'),
      middle: allInserts.filter((insert) => insert.position === 'middle')
    }
  }, [modules])
}
