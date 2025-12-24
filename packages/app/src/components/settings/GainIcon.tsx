import type { Numeric } from '@core/program.js'
import { VolumeDownOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import type { FunctionComponent } from 'react'

export const GainIcon: FunctionComponent<{
  gain: Numeric<'db'>
}> = ({ gain }) => {
  if (gain.value < -48) {
    return <VolumeOffOutlined />
  }

  if (gain.value < -18) {
    return <VolumeDownOutlined />
  }

  return <VolumeUpOutlined />
}
