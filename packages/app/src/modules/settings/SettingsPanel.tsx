import type { PanelProps } from '@meyfa/cadence-editor'
import { useModules } from '@meyfa/cadence-editor'
import { GitHub } from '@mui/icons-material'
import type { FunctionComponent } from 'react'
import { Card } from '../../components/card/Card.tsx'

export const SettingsPanel: FunctionComponent<PanelProps> = () => {
  const modules = useModules()

  const settingsCards = modules.flatMap(({ id, settings }) => {
    return (settings?.cards ?? []).map((Component, index) => ({
      key: `${id}.${index}`,
      Component
    }))
  })

  return (
    <div className='h-full overflow-auto p-4 text-content-300'>
      <div className='max-w-4xl mx-auto flex flex-col gap-4 items-start'>
        <div className='text-xl'>
          Settings
        </div>

        {settingsCards.map(({ key, Component }) => (
          <Component key={key} />
        ))}

        <Card title='About Cadence'>
          <a href='https://github.com/meyfa/cadence' target='_blank' rel='noreferrer' className='outline-none hocus:underline text-content-200 hocus:text-content-300'>
            <GitHub className='mr-2' />
            github.com/meyfa/cadence
          </a>

          <p>
            This app uses open-source libraries.
            Please see: <a href='/license.md' target='_blank' rel='noreferrer' className='outline-none hocus:underline text-content-200 hocus:text-content-300'>licenses</a>
          </p>
        </Card>
      </div>
    </div>
  )
}
