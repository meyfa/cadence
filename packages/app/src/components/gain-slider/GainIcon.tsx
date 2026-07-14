import { VolumeDownOutlined, VolumeOffOutlined, VolumeUpOutlined } from '@mui/icons-material'
import type { Numeric } from '@meyfa/cadence-utility'
import type { FunctionComponent } from 'react'

export const GainIcon: FunctionComponent<{
  gain: Numeric<'db'>
}> = ({ gain }) => {
  if (gain < -48) {
    return <VolumeOffOutlined />
  }

  if (gain < -18) {
    return <VolumeDownOutlined />
  }

  return <VolumeUpOutlined />
}
