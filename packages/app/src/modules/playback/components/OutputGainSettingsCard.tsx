import { useObservable } from '@meyfa/cadence-editor'
import type { FunctionComponent } from 'react'
import { Card } from '../../../components/card/Card.tsx'
import { GainSlider } from '../../../components/gain-slider/GainSlider.tsx'
import { useAudioEngine } from '../provider.tsx'

export const OutputGainSettingsCard: FunctionComponent = () => {
  const engine = useAudioEngine()
  const outputGain = useObservable(engine.outputGain)

  return (
    <Card title='Output gain'>
      Adjust the output gain of the audio engine.

      <GainSlider label='Output gain' gain={outputGain} onChange={(gain) => engine.outputGain.set(gain)} />
    </Card>
  )
}
