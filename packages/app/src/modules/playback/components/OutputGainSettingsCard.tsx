import type { FunctionComponent } from 'react'
import { Card } from '../../../components/card/Card.js'
import { GainSlider } from '../../../components/gain-slider/GainSlider.js'
import { useObservable } from '../../../hooks/observable.js'
import { useAudioEngine } from '../provider.js'

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
