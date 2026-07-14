import type { FunctionComponent } from 'react'
import { Card } from '../../components/card/Card.tsx'
import { Radio } from '../../components/radio/Radio.tsx'
import { RadioGroup } from '../../components/radio/RadioGroup.tsx'
import type { ThemeSetting } from '../../theme.ts'
import { applyThemeSetting, useSystemTheme, useThemeSetting } from '../../theme.ts'

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
