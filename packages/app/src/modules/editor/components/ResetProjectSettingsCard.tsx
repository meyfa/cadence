import { useCommandRegistry, type CommandId } from '@editor'
import { RestartAltOutlined } from '@mui/icons-material'
import type { FunctionComponent } from 'react'
import { Button } from '../../../components/button/Button.js'
import { Card } from '../../../components/card/Card.js'

export const ResetProjectSettingsCard: FunctionComponent = () => {
  const { getCommandById } = useCommandRegistry()

  // TODO do not hardcode command id
  const loadDemoCommand = getCommandById('editor.load-demo' as CommandId)

  if (loadDemoCommand == null) {
    return null
  }

  return (
    <Card title='Reset project'>
      To delete your current project and load the demo project, click the button below.

      <div className='flex items-center gap-4'>
        <Button onClick={() => loadDemoCommand.run()}>
          <RestartAltOutlined className='mr-2' />
          Load demo project
        </Button>
      </div>
    </Card>
  )
}
