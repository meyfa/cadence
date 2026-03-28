import type { FunctionComponent, ReactNode } from 'react'
import { modules } from '../../modules/index.js'
import type { HeaderInsert } from '../../modules/types.js'
import { CommandPalette } from '../commands/CommandPalette.js'
import { MainMenu } from '../commands/MainMenu.js'

const allInserts: readonly HeaderInsert[] = modules.flatMap((module) => module.inserts?.header ?? [])

const insertsByPosition: Record<HeaderInsert['position'], readonly HeaderInsert[]> = {
  start: allInserts.filter((insert) => insert.position === 'start'),
  end: allInserts.filter((insert) => insert.position === 'end')
}

export const Header: FunctionComponent<{
  readonly logo?: ReactNode
}> = ({ logo }) => {
  return (
    <header className='grid grid-cols-2 md:grid-cols-3 items-center px-2 py-1 gap-1 bg-surface-200 border-b border-b-frame-200'>
      <div className='flex items-center gap-1 h-full'>
        {logo && (
          <div className='mr-1 shrink-0'>
            {logo}
          </div>
        )}

        <MainMenu />

        {insertsByPosition.start.map(({ Component }, index) => (
          <Component key={index} />
        ))}
      </div>

      <div className='flex justify-center'>
        <CommandPalette />
      </div>

      <div className='hidden md:block' />
    </header>
  )
}
