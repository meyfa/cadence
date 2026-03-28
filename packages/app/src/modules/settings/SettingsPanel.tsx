import { useCommandRegistry, type CommandId, type PanelProps, type ThemeSetting } from '@editor'
import { GitHub, RestartAltOutlined } from '@mui/icons-material'
import type { FunctionComponent } from 'react'
import { Button } from '../../components/button/Button.js'
import { Card } from '../../components/card/Card.js'
import { GainSlider } from '../../components/gain-slider/GainSlider.js'
import { Radio } from '../../components/radio/Radio.js'
import { RadioGroup } from '../../components/radio/RadioGroup.js'
import { useObservable } from '../../hooks/observable.js'
import { useAudioEngine } from '../../state/AudioEngineContext.js'
import { applyThemeSetting, useSystemTheme, useThemeSetting } from '../../theme.js'

export const SettingsPanel: FunctionComponent<PanelProps> = () => {
  const { getCommandById } = useCommandRegistry()

  const themeSetting = useThemeSetting()
  const systemTheme = useSystemTheme()

  const engine = useAudioEngine()
  const outputGain = useObservable(engine.outputGain)

  // TODO do not hardcode command id
  const loadDemoCommand = getCommandById('editor.load-demo' as CommandId)

  return (
    <div className='h-full overflow-auto p-4 text-content-300'>
      <div className='max-w-4xl mx-auto flex flex-col gap-4 items-start'>
        <div className='text-xl'>
          Settings
        </div>

        <Card title='Output gain'>
          Adjust the output gain of the audio engine.

          <GainSlider label='Output gain' gain={outputGain} onChange={(gain) => engine.outputGain.set(gain)} />
        </Card>

        <Card title='Theme'>
          <RadioGroup value={themeSetting} onChange={(value) => applyThemeSetting(value as ThemeSetting)}>
            <Radio value='dark'>Dark</Radio>
            <Radio value='light'>Light</Radio>
            <Radio value='system'>
              System
              {systemTheme === 'light' ? ' (light)' : ' (dark)'}
            </Radio>
          </RadioGroup>
        </Card>

        {loadDemoCommand != null && (
          <Card title='Reset project'>
            To delete your current project and load the demo project, click the button below.

            <div className='flex items-center gap-4'>
              <Button onClick={() => loadDemoCommand.run()}>
                <RestartAltOutlined className='mr-2' />
                Load demo project
              </Button>
            </div>
          </Card>
        )}

        <Card title='About Cadence'>
          <a href='https://github.com/meyfa/cadence' target='_blank' rel='noreferrer' className='outline-none hocus:underline text-content-200 hocus:text-content-300'>
            <GitHub className='mr-2' />
            github.com/meyfa/cadence
          </a>
        </Card>
      </div>
    </div>
  )
}
