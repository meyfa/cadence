export const demoCode = `
// Press Play to start the demo.

// Import some functions from the standard library.
use "instruments" as *  // sample
use "patterns" as *     // loop
use "effects" as fx

sample_collection = "https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master"

// Define samples to use in the track.
kick  = sample("{sample_collection}/house/000_BD.wav")
snare = sample("{sample_collection}/808sd/SD0010.WAV", gain: -3.db)
hat   = sample("{sample_collection}/808oh/OH00.WAV")
tom   = sample("{sample_collection}/808mt/MT10.WAV")
synth = sample("{sample_collection}/moog/002_Mighty Moog C4.wav", root_note: "C4", length: 0.5.s)
clap  = sample("{sample_collection}/808/CP.WAV")

// Define some reusable patterns (step sequences). 'x' is a hit, '-' is a rest.
// By default, each step is 1 beat long.
// Use loop(pattern) or loop(pattern, times) to repeat patterns infinitely, or a specific amount.
kick_pattern  = loop([xxxx])
snare_pattern = loop([-x])

// Patterns can also define pitches (note and octave) for melodic instruments.
// Division and multiplication (/, *) change pattern timing. Here, /4 creates 16th notes.
arp_intro   = loop([-], 8) + loop([D3:3 D4:3 F4 -] / 4, 4)
arp_main    = ([D3:3 D4:3 G4 G4] + [D3:3 D4:2 G5 G4 F4]) / 4

// Steps can have custom lengths. The hit below is 8 times the default step length.
clap_pattern = [x:8]

track (120.bpm) {
  // Parts play in sequence. Patterns will trigger notes for their
  // defined length or the length of the part, whichever is shorter.

  part intro (4.bars) {
    kick  << kick_pattern
    snare << snare_pattern
    synth << arp_intro

    automate synth.gain as linear(-60.db, 0.db)
  }

  part main (8.bars) {
    kick  << kick_pattern
    snare << snare_pattern
    hat   << loop([--x-] / 4)
    tom   << loop([---- -x-- ---- ---x] / 4)
    synth << loop(arp_main)
    clap  << loop(clap_pattern)
  }

  part outro (4.bars) {
    snare << snare_pattern
    tom   << loop([---- -x-- ---- ---x] / 4)
    synth << loop(arp_main)
    clap  << clap_pattern
  }
}

mixer {
  // Mixer buses are used to modify groups of instruments.
  // Buses can receive signals from instruments, but also other buses.

  bus drums (gain: -1.5.db) {
    kick snare hat tom
  }

  bus synths (gain: -10.db) {
    synth
  }

  // A bus can have zero or more effects, which are applied in order.
  // input -> effects... -> pan -> gain -> output

  bus clap_delay (gain: 3.db, pan: -0.25) {
    clap

    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)
    effect fx.reverb(mix: 0.3, decay: 1.s)
  }
}
`.trimStart()
