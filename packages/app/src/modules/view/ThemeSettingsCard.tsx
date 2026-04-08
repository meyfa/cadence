import type { FunctionComponent } from 'react'
import { Card } from '../../components/card/Card.js'
import { Radio } from '../../components/radio/Radio.js'
import { RadioGroup } from '../../components/radio/RadioGroup.js'
import { applyThemeSetting, useSystemTheme, useThemeSetting, type ThemeSetting } from '../../theme.js'

export const ThemeSettingsCard: FunctionComponent = () => {
  const themeSetting = useThemeSetting()
  const systemTheme = useSystemTheme()

  return (
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
  )
}
