import type { PersistenceDomain } from '@meyfa/cadence-editor'
import { usePersistentBinding } from '@meyfa/cadence-editor'
import { useRef } from 'react'
import type { Struct } from 'superstruct'
import { enums, type } from 'superstruct'
import type { ThemeSetting } from '../../theme.js'
import { applyThemeSetting, useThemeSetting } from '../../theme.js'

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

  // Avoid visual transition on initial load.
  const isFirstLoadRef = useRef(true)

  usePersistentBinding(viewSettingsDomain, { theme: themeSetting }, (persisted) => {
    applyThemeSetting(persisted.theme, { immediate: isFirstLoadRef.current })
    isFirstLoadRef.current = false
  }, { onConflict: 'accept-remote' })
}
