export const demoCode = `
// Press Play to start the demo.

sample_collection = "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/"

// Define samples to use in the track.
kick  = sample(sample_collection + "house/000_BD.wav")
snare = sample(sample_collection + "808sd/SD0010.WAV", gain: -3 db)
hat   = sample(sample_collection + "808oh/OH00.WAV")
tom   = sample(sample_collection + "808mt/MT10.WAV")
synth = sample(sample_collection + "moog/002_Mighty Moog C4.wav", root_note: "C4", length: 0.5s)
clap  = sample(sample_collection + "808/CP.WAV")

// Define some reusable patterns (step sequences). 'x' is a hit, '-' is a rest.
// By default, each step is 1 beat long.
// Use loop(pattern) or loop(pattern, times) to repeat patterns infinitely, or a specific amount.
kick_pattern  = loop([xxxx])
snare_pattern = loop([-x])

// Patterns can also define pitches (note and octave) for melodic instruments.
// Division and multiplication (/, *) change pattern timing. Here, /4 creates 16th notes.
arp_intro   = loop([-], 8) + loop([D3 - - D4 - - F4 -] / 4, 4)
arp_main    = ([D3 - - D4 - - G4 G4] + [D3 - - D4 - G5 G4 F4]) / 4

clap_pattern = [x--- ----]

track {
  tempo: 128 bpm

  // Sections play in sequence. Patterns will trigger notes for their
  // defined length or the length of the section, whichever is shorter.

  section intro for 4 bars {
    kick  << kick_pattern
    snare << snare_pattern
    synth << arp_intro
  }

  section main for 8 bars {
    kick  << kick_pattern
    snare << snare_pattern
    hat   << loop([--x-] / 4)
    tom   << loop([---- -x-- ---- ---x] / 4)
    synth << loop(arp_main)
    clap  << loop(clap_pattern)
  }

  section outro for 4 bars {
    snare << snare_pattern
    tom   << loop([---- -x-- ---- ---x] / 4)
    synth << loop(arp_main)
    clap  << clap_pattern
  }
}

mixer {
  // Mixer buses are used to modify groups of instruments.

  // Buses can receive signals from instruments, but also other buses.
  // Anything not routed to a bus (such as 'out' here) goes to the main output.

  out << drums << kick + snare + hat + tom
  out << synths << synth
  out << clap_delay << clap

  bus out {}

  bus drums {
    gain: -1.5 db
  }

  bus synths {
    gain: -10 db
  }

  // A bus can have zero or more effects.

  bus clap_delay {
    effect delay(time: 0.5 beats, feedback: 0.6)
    effect reverb(decay: 1s, mix: 0.3)
  }
}
`.trimStart()
