export const demoCode = `
# Press Play to start the demo.

sample_collection = "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/"

# Define samples to use in the track.
kick  = sample(url: sample_collection + "house/000_BD.wav")
snare = sample(url: sample_collection + "808sd/SD0010.WAV", gain: -3 db)
hat   = sample(url: sample_collection + "808oh/OH00.WAV")
tom   = sample(url: sample_collection + "808mt/MT10.WAV")
synth = sample(url: sample_collection + "moog/002_Mighty Moog C4.wav", root_note: "C4", length: 0.5s)

# Define some reusable patterns (step sequences). 'x' is a hit, '-' is a rest.
kick_pattern  = [x-x- x--- x--- x---]
snare_pattern = [---- x---]

# Patterns can also define pitches for melodic instruments.
# The * operator repeats a pattern, and + concatenates patterns.
arp_intro   = [----] * 8 + [D3 - - D4 - - F4 -] * 4
arp_main    = [D3 - - D4 - - G4 G4] + [D3 - - D4 - G5 G4 F4]

track {
  tempo: 128 bpm

  # Sections play in sequence. Patterns loop within sections.

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

mixer {
  # Mixer buses are used to modify groups of instruments.

  # Buses can receive signals from instruments, but also other buses.
  # Anything not routed to a bus (such as 'out' here) goes to the main output.

  out << drums + synths
  drums << kick + snare + hat + tom
  synths << synth

  bus out {}

  bus drums {
    gain: -1.5 db
  }

  bus synths {
    gain: -9 db
  }
}
`.trimStart()
