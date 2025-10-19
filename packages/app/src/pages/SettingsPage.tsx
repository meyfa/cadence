import { useCallback, useEffect, useState, type FunctionComponent } from 'react'
import { Button } from '../components/Button.js'
import { CheckOutlined, RestartAltOutlined } from '@mui/icons-material'

export const SettingsPage: FunctionComponent<{
  loadDemo: () => void
}> = ({ loadDemo }) => {
  const [demoLoaded, setDemoLoaded] = useState(false)

  const onClickLoadDemo = useCallback(() => {
    loadDemo()
    setDemoLoaded(true)
  }, [loadDemo])

  useEffect(() => {
    if (demoLoaded) {
      const timer = setTimeout(() => setDemoLoaded(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [demoLoaded])

  return (
    <div className='p-4 text-white'>
      <div className='text-xl mb-4'>Settings</div>

      <div className='flex flex-col gap-4 items-start'>
        <div>
          To delete your current project and load the demo project, click the button below:
        </div>

        <div className='flex items-center gap-4'>
          <Button onClick={onClickLoadDemo} disabled={demoLoaded}>
            <RestartAltOutlined className='mr-2' />
            Load demo project
          </Button>

          {demoLoaded && (
            <div className='flex items-center gap-1'>
              <CheckOutlined />
              Done
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
