import type { PersistenceDomain } from '@editor'
import { usePersistentBinding } from '@editor'
import { enums, type, type Struct } from 'superstruct'
import { applyThemeSetting, useThemeSetting, type ThemeSetting } from '../../theme.js'

export const defaultThemeSetting: ThemeSetting = 'dark'

interface ViewSettings {
  readonly theme: ThemeSetting
}

const viewSettingsSchema: Struct<ViewSettings> = type({
  theme: enums(['dark', 'light', 'system'])
})

const viewSettingsDefaults: ViewSettings = {
  theme: defaultThemeSetting
}

const viewSettingsDomain: PersistenceDomain<ViewSettings> = {
  key: 'view.settings',
  fallbackValue: viewSettingsDefaults,
  serialize: (value) => value,
  deserialize: (value) => viewSettingsSchema.create(value),
  areEqual: (a, b) => a.theme === b.theme
}

export function useViewSettingsSync (): void {
  const themeSetting = useThemeSetting()

  usePersistentBinding(viewSettingsDomain, { theme: themeSetting }, (persisted) => {
    applyThemeSetting(persisted.theme)
  }, { onConflict: 'accept-remote' })
}
