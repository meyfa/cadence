import type { FunctionComponent } from 'react'
import logoUrl from './logo.svg'

export const Logo: FunctionComponent = () => {
  return (
    <img src={logoUrl} alt='Cadence logo' title='Cadence' className='w-8 h-8' />
  )
}
