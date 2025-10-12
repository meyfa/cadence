export const demoCode = `
# Press Play to start the demo.

# Define samples to use in the track.

sample_collection = "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/"

kick  = sample(url: sample_collection + "house/000_BD.wav")
snare = sample(url: sample_collection + "808sd/SD0010.WAV", gain: -3 db)
hat   = sample(url: sample_collection + "808oh/OH00.WAV")
tom   = sample(url: sample_collection + "808mt/MT10.WAV")

synth = sample(url: sample_collection + "moog/002_Mighty Moog C4.wav", gain: -9 db, root_note: "C4", length: 0.5s)

# Define patterns using a simple step sequencer syntax where 'x' is a hit and '-' is a rest.
# Patterns are 16th notes by default, and can be any length.

kick_pattern  = [x-x- x--- x--- x---]
snare_pattern = [---- x---]

arp_intro   = [----] * 8 + [D3 - - D4 - - F4 -] * 4
arp_main    = [D3 - - D4 - - G4 G4] + [D3 - - D4 - G5 G4 F4]

track {
  tempo: 128 bpm

  # Sections play in sequence.
  # Patterns will loop to fill the section length, specified in bars or beats.

  section intro for 4 bars {
    kick  << kick_pattern
    snare << snare_pattern
    synth << arp_intro
  }

  section main for 8 bars {
    kick  << kick_pattern
    snare << snare_pattern
    hat   << [--x- --x- --x- --x-]
    tom   << [---- -x-- ---- ---x]
    synth << arp_main
  }

  section outro for 4 bars {
    snare << snare_pattern
    tom   << [---- -x-- ---- ---x]
    synth << arp_main
  }
}
`.trimStart()
