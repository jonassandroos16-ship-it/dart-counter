export type Ctx = AudioContext | null;

export type Wave = OscillatorType;

export interface Note {
  f: number;       // frequency (Hz)
  start: number;   // beat offset within sequence
  dur: number;     // beats
  gain?: number;
  wave?: Wave;
}

export interface Layer {
  notes: (seq: number[], i: number) => Note[];
  bars: number;    // length of one loop in bars (4/4 time)
}

export interface Track {
  id: string;
  name: string;
  context: 'start' | 'setup' | 'match';
  bpm: number;
  layers: Layer[];
}

// Note helpers
const A4 = 440;
export const N: Record<string, number> = {};
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (let oct = 0; oct <= 7; oct++) {
  for (let i = 0; i < 12; i++) {
    const semis = (oct - 4) * 12 + (i - 9);
    N[`${noteNames[i]}${oct}`] = A4 * Math.pow(2, semis / 12);
  }
}

export const note = (name: string, start: number, dur: number, gain = 0.18, wave: Wave = 'triangle'): Note => ({
  f: N[name] ?? 0, start, dur, gain, wave,
});
