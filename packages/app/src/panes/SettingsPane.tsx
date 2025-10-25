import { type Numeric } from '@core/program.js'
import type { ThemeSetting } from '@editor/state.js'
import { CheckOutlined, GitHub, RestartAltOutlined } from '@mui/icons-material'
import { useCallback, useState, type FunctionComponent } from 'react'
import { Button } from '../components/Button.js'
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog.js'
import { Radio } from '../components/radio/Radio.js'
import { RadioGroup } from '../components/radio/RadioGroup.js'
import { GainSlider } from '../components/settings/GainSlider.js'
import { SettingsPanel } from '../components/settings/SettingsPanel.js'
import { useSystemTheme } from '../theme.js'

export const SettingsPane: FunctionComponent<{
  theme: ThemeSetting
  onChangeTheme: (theme: ThemeSetting) => void

  outputGain: Numeric<'db'>
  onChangeOutputGain: (outputGain: Numeric<'db'>) => void

  loadDemo: () => void
}> = ({ theme, outputGain, onChangeOutputGain, onChangeTheme, loadDemo }) => {
  const systemTheme = useSystemTheme()

  const [confirmLoadDemo, setConfirmLoadDemo] = useState(false)
  const [demoLoaded, setDemoLoaded] = useState(false)

  const onClickLoadDemo = useCallback(() => {
    loadDemo()
    setDemoLoaded(true)
  }, [loadDemo])

  return (
    <div className='h-full overflow-auto p-4 text-content-300'>
      <div className='max-w-4xl mx-auto flex flex-col gap-4 items-start'>
        <div className='text-xl'>
          Settings
        </div>

        <SettingsPanel title='Output gain'>
          Adjust the output gain of the audio engine.

          <GainSlider label='Output gain' gain={outputGain} onChange={onChangeOutputGain} />
        </SettingsPanel>

        <SettingsPanel title='Theme'>
          <RadioGroup value={theme} onChange={(value) => onChangeTheme(value as ThemeSetting)}>
            <Radio value='dark'>Dark</Radio>
            <Radio value='light'>Light</Radio>
            <Radio value='system'>
              System
              {systemTheme === 'light' ? ' (light)' : ' (dark)'}
            </Radio>
          </RadioGroup>
        </SettingsPanel>

        <SettingsPanel title='Reset project'>
          To delete your current project and load the demo project, click the button below.

          <div className='flex items-center gap-4'>
            <Button onClick={() => setConfirmLoadDemo(true)}>
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

          <ConfirmationDialog
            open={confirmLoadDemo}
            onConfirm={() => {
              onClickLoadDemo()
              setConfirmLoadDemo(false)
            }}
            onCancel={() => setConfirmLoadDemo(false)}
            title='Load demo project?'
          >
            This will delete your current project. Continue?
          </ConfirmationDialog>
        </SettingsPanel>

        <SettingsPanel title='About Cadence'>
          <a href='https://github.com/meyfa/cadence' target='_blank' rel='noreferrer' className='outline-none hocus:underline text-content-200 hocus:text-content-300'>
            <GitHub className='mr-2' />
            github.com/meyfa/cadence
          </a>
        </SettingsPanel>
      </div>
    </div>
  )
}
