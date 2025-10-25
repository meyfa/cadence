import { type Numeric } from '@core/program.js'
import type { Theme } from '@editor/state.js'
import { CheckOutlined, GitHub, RestartAltOutlined } from '@mui/icons-material'
import { useCallback, useState, type FunctionComponent } from 'react'
import { Button } from '../components/Button.js'
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog.js'
import { Radio } from '../components/radio/Radio.js'
import { RadioGroup } from '../components/radio/RadioGroup.js'
import { GainSlider } from '../components/settings/GainSlider.js'
import { SettingsPanel } from '../components/settings/SettingsPanel.js'

export const SettingsPane: FunctionComponent<{
  theme: Theme
  onChangeTheme: (theme: Theme) => void

  outputGain: Numeric<'db'>
  onChangeOutputGain: (outputGain: Numeric<'db'>) => void

  loadDemo: () => void
}> = ({ theme, outputGain, onChangeOutputGain, onChangeTheme, loadDemo }) => {
  const [confirmLoadDemo, setConfirmLoadDemo] = useState(false)
  const [demoLoaded, setDemoLoaded] = useState(false)

  const onClickLoadDemo = useCallback(() => {
    loadDemo()
    setDemoLoaded(true)
  }, [loadDemo])

  return (
    <div className='h-full overflow-auto p-4 text-white'>
      <div className='max-w-4xl mx-auto flex flex-col gap-4 items-start'>
        <div className='text-xl'>
          Settings
        </div>

        <SettingsPanel title='Output gain'>
          Adjust the output gain of the audio engine.

          <GainSlider label='Output gain' gain={outputGain} onChange={onChangeOutputGain} />
        </SettingsPanel>

        <SettingsPanel title='Theme'>
          Light theme is not yet available. Please check back later.

          <RadioGroup value={theme} onChange={(value) => onChangeTheme(value as Theme)}>
            <Radio value='dark'>Dark</Radio>
            <Radio value='light' disabled>Light</Radio>
            <Radio value='system' disabled>System</Radio>
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
          <a href='https://github.com/meyfa/cadence' target='_blank' rel='noreferrer' className='outline-none hocus:underline hocus:text-white'>
            <GitHub className='mr-2' />
            github.com/meyfa/cadence
          </a>
        </SettingsPanel>
      </div>
    </div>
  )
}
