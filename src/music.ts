import type { Settings } from './types';

type Ctx = AudioContext | null;

type Wave = OscillatorType;

interface Note {
  f: number;       // frequency (Hz)
  start: number;   // beat offset within sequence
  dur: number;     // beats
  gain?: number;
  wave?: Wave;
}

interface Layer {
  notes: (seq: number[], i: number) => Note[];
  bars: number;    // length of one loop in bars (4/4 time)
}

interface Track {
  id: string;
  name: string;
  context: 'start' | 'setup' | 'match';
  bpm: number;
  layers: Layer[];
}

// Note helpers
const A4 = 440;
const N: Record<string, number> = {};
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
for (let oct = 0; oct <= 7; oct++) {
  for (let i = 0; i < 12; i++) {
    const semis = (oct - 4) * 12 + (i - 9);
    N[`${noteNames[i]}${oct}`] = A4 * Math.pow(2, semis / 12);
  }
}

const note = (name: string, start: number, dur: number, gain = 0.18, wave: Wave = 'triangle'): Note => ({
  f: N[name] ?? 0, start, dur, gain, wave,
});

// ── New default start theme: "Bullseye Anthem" ─────────────────────────
// Heroic major-key anthem with a strong melodic hook, driving rock beat,
// and a triumphant brass-style fanfare. Properly loops in 8 bars.
const bullseyeAnthem: Track = {
  id: 'start_bullseye_anthem',
  name: 'Bullseye Anthem',
  context: 'start',
  bpm: 124,
  layers: [
    // Driving rock bass — root-fifth pulse, 8 bars
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        const roots = ['A1', 'A1', 'F1', 'G1', 'A1', 'A1', 'F1', 'G1'];
        for (let bar = 0; bar < 8; bar++) {
          const r = roots[bar];
          for (let i = 0; i < 8; i++) {
            const octave = i % 4 === 0 ? r : (i % 4 === 2 ? r.replace('1', '2') : r);
            out.push(note(octave, bar * 4 + i * 0.5, 0.45, 0.22, 'sawtooth'));
          }
        }
        return out;
      },
    },
    // Kick + snare rock beat
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let bar = 0; bar < 8; bar++) {
          for (let i = 0; i < 4; i++) {
            const t = bar * 4 + i;
            // Kick on 1 and 3
            out.push(note('A0', t, 0.35, 0.42, 'sine'));
            if (i === 1 || i === 3) out.push(note('C6', t, 0.18, 0.14, 'square'));
            // Hat on every 8th
            out.push(note('E6', t + 0.5, 0.08, 0.08, 'square'));
          }
        }
        return out;
      },
    },
    // Heroic lead melody — 8-bar phrase, A major
    {
      bars: 8,
      notes: () => [
        // Bar 1: A major hook
        note('A4', 0, 0.75, 0.26, 'square'),
        note('C#5', 0.75, 0.25, 0.22, 'square'),
        note('E5', 1, 0.75, 0.28, 'square'),
        note('A5', 1.75, 0.25, 0.24, 'square'),
        note('G5', 2, 0.5, 0.26, 'square'),
        note('E5', 2.5, 0.5, 0.24, 'square'),
        note('C#5', 3, 1, 0.26, 'square'),
        // Bar 2: climb
        note('E5', 4, 0.5, 0.26, 'square'),
        note('F#5', 4.5, 0.5, 0.24, 'square'),
        note('G5', 5, 0.5, 0.26, 'square'),
        note('A5', 5.5, 0.5, 0.28, 'square'),
        note('B5', 6, 1, 0.28, 'square'),
        note('A5', 7, 1, 0.26, 'square'),
        // Bar 3: F major contrast
        note('F5', 8, 0.75, 0.26, 'square'),
        note('A5', 8.75, 0.25, 0.24, 'square'),
        note('C6', 9, 0.75, 0.28, 'square'),
        note('A5', 9.75, 0.25, 0.24, 'square'),
        note('G5', 10, 0.5, 0.26, 'square'),
        note('F5', 10.5, 0.5, 0.24, 'square'),
        note('E5', 11, 1, 0.26, 'square'),
        // Bar 4: walk up
        note('C5', 12, 0.5, 0.24, 'square'),
        note('D5', 12.5, 0.5, 0.24, 'square'),
        note('E5', 13, 0.5, 0.26, 'square'),
        note('F5', 13.5, 0.5, 0.26, 'square'),
        note('G5', 14, 1, 0.28, 'square'),
        note('A5', 15, 1, 0.3, 'square'),
        // Bar 5: repeat hook
        note('A4', 16, 0.75, 0.26, 'square'),
        note('C#5', 16.75, 0.25, 0.22, 'square'),
        note('E5', 17, 0.75, 0.28, 'square'),
        note('A5', 17.75, 0.25, 0.24, 'square'),
        note('G5', 18, 0.5, 0.26, 'square'),
        note('E5', 18.5, 0.5, 0.24, 'square'),
        note('C#5', 19, 1, 0.26, 'square'),
        // Bar 6: triumphant climb
        note('E5', 20, 0.5, 0.26, 'square'),
        note('F#5', 20.5, 0.5, 0.24, 'square'),
        note('G5', 21, 0.5, 0.26, 'square'),
        note('A5', 21.5, 0.5, 0.28, 'square'),
        note('C6', 22, 1, 0.3, 'square'),
        note('B5', 23, 1, 0.28, 'square'),
        // Bar 7: G major
        note('B4', 24, 0.75, 0.26, 'square'),
        note('D5', 24.75, 0.25, 0.24, 'square'),
        note('G5', 25, 0.75, 0.28, 'square'),
        note('B5', 25.75, 0.25, 0.24, 'square'),
        note('A5', 26, 0.5, 0.26, 'square'),
        note('G5', 26.5, 0.5, 0.24, 'square'),
        note('F5', 27, 1, 0.26, 'square'),
        // Bar 8: resolve to A
        note('E5', 28, 0.5, 0.26, 'square'),
        note('F5', 28.5, 0.5, 0.26, 'square'),
        note('G5', 29, 0.5, 0.28, 'square'),
        note('A5', 29.5, 0.5, 0.3, 'square'),
        note('C6', 30, 1, 0.32, 'square'),
        note('A5', 31, 1, 0.3, 'square'),
      ],
    },
    // Brass-style harmony stabs
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        const chords: [string, number][] = [
          ['A3-C#4-E4', 0], ['A3-C#4-E4', 1], ['A3-C#4-E4', 2], ['E3-G#3-B3', 3],
          ['F3-A3-C4', 4], ['F3-A3-C4', 5], ['C3-E3-G3', 6], ['C3-E3-G3', 7],
          ['A3-C#4-E4', 8], ['A3-C#4-E4', 9], ['A3-C#4-E4', 10], ['E3-G#3-B3', 11],
          ['G3-B3-D4', 12], ['G3-B3-D4', 13], ['G3-B3-D4', 14], ['A3-C#4-E4', 15],
        ];
        for (let bar = 0; bar < 8; bar++) {
          for (let beat = 0; beat < 4; beat++) {
            const chord = chords[bar * 2 + Math.floor(beat / 2)] || chords[0];
            if (beat === 0 || beat === 2) {
              chord[0].split('-').forEach(n => out.push(note(n, bar * 4 + beat, 0.45, 0.12, 'sawtooth')));
            }
          }
        }
        return out;
      },
    },
    // Sustained pad
    {
      bars: 8,
      notes: () => [
        { ...note('A2', 0, 4, 0.14, 'sine') },
        { ...note('E3', 0, 4, 0.1, 'sine') },
        { ...note('A3', 0, 4, 0.08, 'sine') },
        { ...note('F2', 4, 4, 0.14, 'sine') },
        { ...note('C3', 4, 4, 0.1, 'sine') },
        { ...note('F3', 4, 4, 0.08, 'sine') },
        { ...note('D2', 8, 4, 0.14, 'sine') },
        { ...note('A3', 8, 4, 0.1, 'sine') },
        { ...note('C3', 12, 4, 0.14, 'sine') },
        { ...note('G3', 12, 4, 0.1, 'sine') },
        { ...note('A2', 16, 4, 0.14, 'sine') },
        { ...note('E3', 16, 4, 0.1, 'sine') },
        { ...note('F2', 20, 4, 0.14, 'sine') },
        { ...note('C3', 20, 4, 0.1, 'sine') },
        { ...note('G2', 24, 4, 0.14, 'sine') },
        { ...note('D3', 24, 4, 0.1, 'sine') },
        { ...note('E3', 28, 4, 0.14, 'sine') },
        { ...note('A2', 28, 4, 0.1, 'sine') },
      ],
    },
  ],
};

// Legacy "Dart Wars" theme kept for users who prefer it.
const dartWarsTheme: Track = {
  id: 'start_dart_wars',
  name: 'Dart Wars Theme',
  context: 'start',
  bpm: 132,
  layers: [
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let bar = 0; bar < 8; bar++) {
          const root = bar < 2 || (bar >= 4 && bar < 6) ? 'A1' : 'F1';
          for (let i = 0; i < 8; i++) {
            const name = i === 0 || i === 4 ? root : (bar < 2 || (bar >= 4 && bar < 6) ? 'A2' : 'F2');
            out.push(note(name, bar * 8 + i, 0.5, 0.18, 'sawtooth'));
          }
        }
        return out;
      },
    },
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let i = 0; i < 64; i++) {
          if (i % 2 === 0) out.push(note('A0', i, 0.4, 0.32, 'sine'));
        }
        return out;
      },
    },
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let i = 0; i < 64; i++) {
          if (i % 2 === 1) out.push(note('C6', i + 0.5, 0.12, 0.07, 'square'));
        }
        return out;
      },
    },
    {
      bars: 8,
      notes: () => [
        note('E4', 0, 1, 0.2, 'square'),
        note('G4', 1, 0.5, 0.18, 'square'),
        note('A4', 1.5, 1.5, 0.22, 'square'),
        note('B4', 3, 0.5, 0.18, 'square'),
        note('C5', 3.5, 0.5, 0.18, 'square'),
        note('B4', 4, 1, 0.18, 'square'),
        note('A4', 5, 0.5, 0.18, 'square'),
        note('G4', 5.5, 0.5, 0.18, 'square'),
        note('E4', 6, 1, 0.18, 'square'),
        note('D4', 7, 1, 0.18, 'square'),
        note('E4', 8, 0.5, 0.18, 'square'),
        note('G4', 8.5, 0.5, 0.18, 'square'),
        note('A4', 9, 0.5, 0.18, 'square'),
        note('B4', 9.5, 0.5, 0.18, 'square'),
        note('C5', 10, 1, 0.2, 'square'),
        note('D5', 11, 0.5, 0.18, 'square'),
        note('E5', 11.5, 1.5, 0.24, 'square'),
        note('D5', 13, 0.5, 0.18, 'square'),
        note('C5', 13.5, 0.5, 0.18, 'square'),
        note('B4', 14, 1, 0.18, 'square'),
        note('A4', 15, 1, 0.2, 'square'),
        note('C5', 16, 1, 0.2, 'square'),
        note('B4', 17, 0.5, 0.18, 'square'),
        note('A4', 17.5, 0.5, 0.18, 'square'),
        note('G4', 18, 1, 0.18, 'square'),
        note('A4', 19, 1, 0.18, 'square'),
        note('F4', 20, 1, 0.18, 'square'),
        note('E4', 21, 0.5, 0.18, 'square'),
        note('D4', 21.5, 0.5, 0.18, 'square'),
        note('E4', 22, 2, 0.2, 'square'),
        note('A4', 24, 1, 0.2, 'square'),
        note('G4', 25, 0.5, 0.18, 'square'),
        note('F4', 25.5, 0.5, 0.18, 'square'),
        note('E4', 26, 1, 0.18, 'square'),
        note('F4', 27, 1, 0.18, 'square'),
        note('D4', 28, 0.5, 0.18, 'square'),
        note('E4', 28.5, 0.5, 0.18, 'square'),
        note('F4', 29, 0.5, 0.18, 'square'),
        note('G4', 29.5, 0.5, 0.18, 'square'),
        note('A4', 30, 1, 0.2, 'square'),
        note('B4', 31, 0.5, 0.18, 'square'),
        note('C5', 31.5, 0.5, 0.18, 'square'),
      ],
    },
    {
      bars: 8,
      notes: () => [
        { ...note('A2', 0, 4, 0.12, 'sine') },
        { ...note('A3', 0, 4, 0.1, 'sine') },
        { ...note('E3', 0, 4, 0.08, 'sine') },
        { ...note('F2', 4, 4, 0.12, 'sine') },
        { ...note('F3', 4, 4, 0.1, 'sine') },
        { ...note('C3', 4, 4, 0.08, 'sine') },
        { ...note('A2', 8, 4, 0.12, 'sine') },
        { ...note('E3', 8, 4, 0.08, 'sine') },
        { ...note('A3', 8, 4, 0.1, 'sine') },
        { ...note('E3', 12, 4, 0.12, 'sine') },
        { ...note('B3', 12, 4, 0.08, 'sine') },
        { ...note('G3', 12, 4, 0.08, 'sine') },
        { ...note('C3', 16, 4, 0.12, 'sine') },
        { ...note('G3', 16, 4, 0.1, 'sine') },
        { ...note('E3', 16, 4, 0.08, 'sine') },
        { ...note('F2', 20, 4, 0.12, 'sine') },
        { ...note('A3', 20, 4, 0.1, 'sine') },
        { ...note('C3', 20, 4, 0.08, 'sine') },
        { ...note('D3', 24, 4, 0.12, 'sine') },
        { ...note('A3', 24, 4, 0.1, 'sine') },
        { ...note('F3', 24, 4, 0.08, 'sine') },
        { ...note('A2', 28, 4, 0.14, 'sine') },
        { ...note('E3', 28, 4, 0.1, 'sine') },
        { ...note('A3', 28, 4, 0.12, 'sine') },
      ],
    },
  ],
};

const setupTracks: Track[] = [
  {
    id: 'setup_horizon',
    name: 'Horizon',
    context: 'setup',
    bpm: 84,
    layers: [
      {
        bars: 8,
        notes: () => {
          const prog = [
            ['F2', 'A3', 'C4', 'F4'],
            ['C2', 'G3', 'C4', 'E4'],
            ['D2', 'A3', 'D4', 'F4'],
            ['A2', 'E3', 'A3', 'C4'],
          ];
          const out: Note[] = [];
          prog.forEach((chord, ci) => {
            chord.forEach((n, ni) => {
              out.push({ ...note(n, ci * 8, 8, 0.12, 'sine') });
              if (ni === 0) out.push({ ...note(n, ci * 8, 8, 0.14, 'triangle') });
            });
          });
          return out;
        },
      },
      {
        bars: 8,
        notes: () => {
          const arps = [
            ['F4', 'A4', 'C5', 'A4'],
            ['C4', 'E4', 'G4', 'E4'],
            ['D4', 'F4', 'A4', 'F4'],
            ['A3', 'C4', 'E4', 'C4'],
          ];
          const out: Note[] = [];
          arps.forEach((arp, ci) => {
            for (let i = 0; i < 32; i++) {
              const n = arp[i % arp.length];
              out.push(note(n, ci * 8 + i * 0.25, 0.22, 0.12, 'triangle'));
            }
          });
          return out;
        },
      },
      {
        bars: 8,
        notes: () => [
          note('C5', 0, 1.5, 0.14, 'sine'),
          note('D5', 1.5, 0.5, 0.13, 'sine'),
          note('F5', 2, 1.5, 0.14, 'sine'),
          note('E5', 3.5, 0.5, 0.13, 'sine'),
          note('G4', 4, 1, 0.14, 'sine'),
          note('E4', 5, 1, 0.13, 'sine'),
          note('F4', 6, 2, 0.14, 'sine'),
          note('A4', 8, 1.5, 0.14, 'sine'),
          note('G4', 9.5, 0.5, 0.13, 'sine'),
          note('E4', 10, 1.5, 0.14, 'sine'),
          note('D4', 11.5, 0.5, 0.13, 'sine'),
          note('C4', 12, 2, 0.14, 'sine'),
          note('E4', 14, 2, 0.14, 'sine'),
          note('F5', 16, 1.5, 0.14, 'sine'),
          note('G5', 17.5, 0.5, 0.13, 'sine'),
          note('A5', 18, 1.5, 0.14, 'sine'),
          note('G5', 19.5, 0.5, 0.13, 'sine'),
          note('E5', 20, 1, 0.14, 'sine'),
          note('C5', 21, 1, 0.13, 'sine'),
          note('D5', 22, 2, 0.14, 'sine'),
          note('F4', 24, 1.5, 0.14, 'sine'),
          note('E5', 25.5, 0.5, 0.13, 'sine'),
          note('D5', 26, 1.5, 0.14, 'sine'),
          note('C5', 27.5, 0.5, 0.13, 'sine'),
          note('A4', 28, 2, 0.14, 'sine'),
          note('F4', 30, 2, 0.14, 'sine'),
        ],
      },
    ],
  },
  {
    id: 'setup_marimba',
    name: 'Marimba Drift',
    context: 'setup',
    bpm: 96,
    layers: [
      {
        bars: 4,
        notes: () => {
          const arps = [
            ['E4', 'G4', 'B4', 'G4'],
            ['C4', 'E4', 'G4', 'E4'],
            ['A3', 'C4', 'E4', 'C4'],
            ['B3', 'D4', 'G4', 'D4'],
          ];
          const out: Note[] = [];
          arps.forEach((arp, ci) => {
            for (let i = 0; i < 8; i++) {
              const n = arp[i % arp.length];
              out.push(note(n, ci * 4 + i * 0.5, 0.4, 0.16, 'triangle'));
            }
          });
          return out;
        },
      },
      {
        bars: 4,
        notes: () => [
          note('E2', 0, 4, 0.14, 'sine'),
          note('C3', 4, 4, 0.14, 'sine'),
          note('A2', 8, 4, 0.14, 'sine'),
          note('B2', 12, 4, 0.14, 'sine'),
        ],
      },
      {
        bars: 4,
        notes: () => [
          note('B4', 0, 0.5, 0.14, 'triangle'),
          note('D5', 0.5, 0.5, 0.14, 'triangle'),
          note('E5', 1, 0.5, 0.14, 'triangle'),
          note('D5', 1.5, 0.5, 0.14, 'triangle'),
          note('G4', 2, 1, 0.14, 'triangle'),
          note('E4', 3, 1, 0.14, 'triangle'),
          note('C5', 4, 0.5, 0.14, 'triangle'),
          note('E5', 4.5, 0.5, 0.14, 'triangle'),
          note('G5', 5, 0.5, 0.14, 'triangle'),
          note('E5', 5.5, 0.5, 0.14, 'triangle'),
          note('D5', 6, 1, 0.14, 'triangle'),
          note('B4', 7, 1, 0.14, 'triangle'),
          note('A4', 8, 0.5, 0.14, 'triangle'),
          note('C5', 8.5, 0.5, 0.14, 'triangle'),
          note('E5', 9, 0.5, 0.14, 'triangle'),
          note('C5', 9.5, 0.5, 0.14, 'triangle'),
          note('B4', 10, 1, 0.14, 'triangle'),
          note('G4', 11, 1, 0.14, 'triangle'),
          note('D5', 12, 0.5, 0.14, 'triangle'),
          note('F5', 12.5, 0.5, 0.14, 'triangle'),
          note('A5', 13, 0.5, 0.14, 'triangle'),
          note('G5', 13.5, 0.5, 0.14, 'triangle'),
          note('F5', 14, 1, 0.14, 'triangle'),
          note('D5', 15, 1, 0.14, 'triangle'),
        ],
      },
    ],
  },
  {
    id: 'setup_lofi',
    name: 'Lo-fi Chill',
    context: 'setup',
    bpm: 72,
    layers: [
      {
        bars: 8,
        notes: () => {
          const prog = [
            ['F2', 'F3', 'A3', 'C4'],
            ['E2', 'E3', 'G3', 'B3'],
            ['D2', 'D3', 'F3', 'A3'],
            ['C2', 'C3', 'E3', 'G3'],
          ];
          const out: Note[] = [];
          prog.forEach((chord, ci) => {
            chord.forEach((n) => out.push({ ...note(n, ci * 8, 8, 0.12, 'sine') }));
          });
          return out;
        },
      },
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            if (i % 4 === 0) out.push(note('A0', i, 0.4, 0.32, 'sine'));
            if (i % 4 === 2) out.push(note('C6', i + 0.5, 0.15, 0.08, 'square'));
          }
          return out;
        },
      },
      {
        bars: 8,
        notes: () => [
          note('A4', 0, 1, 0.13, 'triangle'),
          note('C5', 1, 1, 0.13, 'triangle'),
          note('A4', 2, 2, 0.13, 'triangle'),
          note('G4', 4, 1, 0.13, 'triangle'),
          note('B4', 5, 1, 0.13, 'triangle'),
          note('G4', 6, 2, 0.13, 'triangle'),
          note('F4', 8, 1, 0.13, 'triangle'),
          note('A4', 9, 1, 0.13, 'triangle'),
          note('F4', 10, 2, 0.13, 'triangle'),
          note('E4', 12, 2, 0.13, 'triangle'),
          note('G4', 14, 2, 0.13, 'triangle'),
          note('C5', 16, 1, 0.13, 'triangle'),
          note('E5', 17, 1, 0.13, 'triangle'),
          note('C5', 18, 2, 0.13, 'triangle'),
          note('B4', 20, 1, 0.13, 'triangle'),
          note('D5', 21, 1, 0.13, 'triangle'),
          note('B4', 22, 2, 0.13, 'triangle'),
          note('A4', 24, 1, 0.13, 'triangle'),
          note('F4', 25, 1, 0.13, 'triangle'),
          note('A4', 26, 2, 0.13, 'triangle'),
          note('G4', 28, 2, 0.13, 'triangle'),
          note('F4', 30, 2, 0.13, 'triangle'),
        ],
      },
    ],
  },
  // ── New setup track: "Oche Lounge" — jazzy, relaxed ──────────────────
  {
    id: 'setup_oche_lounge',
    name: 'Oche Lounge',
    context: 'setup',
    bpm: 90,
    layers: [
      // Jazzy walking bass — 8 bars
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          const walk = ['A2', 'C3', 'E3', 'G3', 'F2', 'A2', 'C3', 'E3', 'D2', 'F2', 'A2', 'C3', 'G2', 'B2', 'D3', 'F3'];
          for (let i = 0; i < 32; i++) {
            out.push(note(walk[i], i, 0.9, 0.2, 'sine'));
          }
          return out;
        },
      },
      // Rhodes-style chord stabs
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          const chords = [
            ['A3', 'C4', 'E4'], ['A3', 'C4', 'E4'],
            ['F3', 'A3', 'C4'], ['F3', 'A3', 'C4'],
            ['D3', 'F3', 'A3'], ['D3', 'F3', 'A3'],
            ['G3', 'B3', 'D4'], ['G3', 'B3', 'D4'],
          ];
          for (let bar = 0; bar < 8; bar++) {
            const c = chords[bar];
            c.forEach(n => out.push(note(n, bar * 4 + 0.5, 1.5, 0.1, 'triangle')));
            c.forEach(n => out.push(note(n, bar * 4 + 2.5, 1.2, 0.09, 'triangle')));
          }
          return out;
        },
      },
      // Soft brush beat
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          for (let bar = 0; bar < 8; bar++) {
            out.push(note('A0', bar * 4, 0.3, 0.28, 'sine'));
            out.push(note('C6', bar * 4 + 1, 0.12, 0.08, 'square'));
            out.push(note('A0', bar * 4 + 2, 0.3, 0.24, 'sine'));
            out.push(note('C6', bar * 4 + 3, 0.12, 0.08, 'square'));
            for (let i = 0; i < 4; i++) out.push(note('E6', bar * 4 + i + 0.5, 0.06, 0.05, 'square'));
          }
          return out;
        },
      },
      // Laid-back melody
      {
        bars: 8,
        notes: () => [
          note('E5', 0, 1.5, 0.16, 'sine'),
          note('D5', 1.5, 0.5, 0.14, 'sine'),
          note('C5', 2, 1, 0.16, 'sine'),
          note('A4', 3, 1, 0.14, 'sine'),
          note('C5', 4, 1.5, 0.16, 'sine'),
          note('A4', 5.5, 0.5, 0.14, 'sine'),
          note('F4', 6, 2, 0.16, 'sine'),
          note('A4', 8, 1.5, 0.16, 'sine'),
          note('G4', 9.5, 0.5, 0.14, 'sine'),
          note('F4', 10, 1, 0.16, 'sine'),
          note('D4', 11, 1, 0.14, 'sine'),
          note('F4', 12, 1.5, 0.16, 'sine'),
          note('A4', 13.5, 0.5, 0.14, 'sine'),
          note('G4', 14, 2, 0.16, 'sine'),
          note('B4', 16, 1.5, 0.16, 'sine'),
          note('A4', 17.5, 0.5, 0.14, 'sine'),
          note('G4', 18, 1, 0.16, 'sine'),
          note('E4', 19, 1, 0.14, 'sine'),
          note('D4', 20, 2, 0.16, 'sine'),
          note('E5', 22, 2, 0.18, 'sine'),
          note('A4', 24, 1.5, 0.16, 'sine'),
          note('C5', 25.5, 0.5, 0.14, 'sine'),
          note('E5', 26, 2, 0.18, 'sine'),
          note('A5', 28, 4, 0.2, 'sine'),
        ],
      },
    ],
  },
];

const matchTracks: Track[] = [
  {
    id: 'match_drive',
    name: 'Drive',
    context: 'match',
    bpm: 140,
    layers: [
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const roots = ['A1', 'A1', 'F1', 'G1'];
          for (let bar = 0; bar < 4; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 8; i++) {
              out.push(note(r, bar * 4 + i * 0.5, 0.4, 0.22, 'sawtooth'));
            }
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            if (i % 2 === 0) out.push(note('A0', i * 0.5, 0.3, 0.36, 'sine'));
            out.push(note('C6', i * 0.5 + 0.25, 0.1, 0.06, 'square'));
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => [
          note('A4', 0, 0.5, 0.16, 'square'),
          note('C5', 0.5, 0.5, 0.16, 'square'),
          note('E5', 1, 0.5, 0.16, 'square'),
          note('A5', 1.5, 0.5, 0.16, 'square'),
          note('G5', 2, 0.5, 0.16, 'square'),
          note('E5', 2.5, 0.5, 0.16, 'square'),
          note('D5', 3, 0.5, 0.16, 'square'),
          note('C5', 3.5, 0.5, 0.16, 'square'),
          note('F5', 4, 0.5, 0.16, 'square'),
          note('A5', 4.5, 0.5, 0.16, 'square'),
          note('C6', 5, 0.5, 0.16, 'square'),
          note('A5', 5.5, 0.5, 0.16, 'square'),
          note('G5', 6, 0.5, 0.16, 'square'),
          note('F5', 6.5, 0.5, 0.16, 'square'),
          note('E5', 7, 1, 0.16, 'square'),
          note('D5', 8, 0.5, 0.16, 'square'),
          note('E5', 8.5, 0.5, 0.16, 'square'),
          note('F5', 9, 0.5, 0.16, 'square'),
          note('E5', 9.5, 0.5, 0.16, 'square'),
          note('D5', 10, 0.5, 0.16, 'square'),
          note('C5', 10.5, 0.5, 0.16, 'square'),
          note('A4', 11, 1, 0.16, 'square'),
          note('G4', 12, 0.5, 0.16, 'square'),
          note('A4', 12.5, 0.5, 0.16, 'square'),
          note('C5', 13, 0.5, 0.16, 'square'),
          note('E5', 13.5, 0.5, 0.16, 'square'),
          note('A5', 14, 1, 0.18, 'square'),
          note('A4', 15, 1, 0.18, 'square'),
        ],
      },
    ],
  },
  {
    id: 'match_arena',
    name: 'Arena',
    context: 'match',
    bpm: 128,
    layers: [
      {
        bars: 4,
        notes: () => {
          const stabs = [
            ['D4', 'F4', 'A4'],
            ['C4', 'F4', 'A4'],
            ['B3', 'E4', 'G4'],
            ['A3', 'E4', 'A4'],
          ];
          const out: Note[] = [];
          for (let bar = 0; bar < 4; bar++) {
            const chord = stabs[bar];
            for (let i = 0; i < 4; i++) {
              chord.forEach((n) => out.push(note(n, bar * 4 + i + 0.5, 0.4, 0.12, 'square')));
            }
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 16; i++) {
            if (i % 2 === 0) out.push(note('A0', i, 0.35, 0.38, 'sine'));
            else out.push(note('C6', i, 0.12, 0.08, 'square'));
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => {
          const roots = ['D1', 'C1', 'B0', 'A0'];
          const out: Note[] = [];
          for (let bar = 0; bar < 4; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 4; i++) out.push(note(r, bar * 4 + i, 0.9, 0.2, 'sawtooth'));
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => [
          note('D5', 0, 0.5, 0.18, 'square'),
          note('F5', 0.5, 0.5, 0.18, 'square'),
          note('A5', 1, 1, 0.2, 'square'),
          note('A5', 2, 0.5, 0.18, 'square'),
          note('G5', 2.5, 0.5, 0.18, 'square'),
          note('F5', 3, 1, 0.18, 'square'),
          note('C5', 4, 0.5, 0.18, 'square'),
          note('E5', 4.5, 0.5, 0.18, 'square'),
          note('A5', 5, 1, 0.2, 'square'),
          note('G5', 6, 0.5, 0.18, 'square'),
          note('E5', 6.5, 0.5, 0.18, 'square'),
          note('C5', 7, 1, 0.18, 'square'),
          note('B4', 8, 0.5, 0.18, 'square'),
          note('D5', 8.5, 0.5, 0.18, 'square'),
          note('G5', 9, 1, 0.2, 'square'),
          note('A5', 10, 0.5, 0.18, 'square'),
          note('G5', 10.5, 0.5, 0.18, 'square'),
          note('F5', 11, 1, 0.18, 'square'),
          note('A4', 12, 0.5, 0.18, 'square'),
          note('C5', 12.5, 0.5, 0.18, 'square'),
          note('E5', 13, 1, 0.2, 'square'),
          note('A5', 14, 1, 0.2, 'square'),
          note('A4', 15, 1, 0.2, 'square'),
        ],
      },
    ],
  },
  {
    id: 'match_pulse',
    name: 'Pulse Runner',
    context: 'match',
    bpm: 150,
    layers: [
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            out.push(note('A1', i * 0.5, 0.4, 0.2, 'sawtooth'));
            if (i % 4 === 2) out.push(note('E2', i * 0.5, 0.4, 0.18, 'sawtooth'));
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const chords = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['E3', 'G3', 'B3']];
          for (let bar = 0; bar < 4; bar++) {
            const c = chords[bar];
            for (let i = 0; i < 8; i++) {
              if (i % 2 === 0) c.forEach((n) => out.push(note(n, bar * 4 + i * 0.5, 0.35, 0.1, 'square')));
            }
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            out.push(note('A0', i * 0.5, 0.25, 0.32, 'sine'));
            out.push(note('C6', i * 0.5 + 0.25, 0.08, 0.06, 'square'));
          }
          return out;
        },
      },
      {
        bars: 4,
        notes: () => {
          const arps = [
            ['A4', 'C5', 'E5', 'A5'],
            ['F4', 'A4', 'C5', 'F5'],
            ['D4', 'F4', 'A4', 'D5'],
            ['E4', 'G4', 'B4', 'E5'],
          ];
          const out: Note[] = [];
          arps.forEach((arp, ci) => {
            for (let i = 0; i < 16; i++) {
              out.push(note(arp[i % arp.length], ci * 4 + i * 0.25, 0.22, 0.14, 'square'));
            }
          });
          return out;
        },
      },
    ],
  },
  // ── New match track: "Checkout Rush" — high-energy electronic ─────────
  {
    id: 'match_checkout_rush',
    name: 'Checkout Rush',
    context: 'match',
    bpm: 145,
    layers: [
      // Pulsing sub bass
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const roots = ['A1', 'A1', 'F1', 'G1'];
          for (let bar = 0; bar < 4; bar++) {
            for (let i = 0; i < 16; i++) {
              out.push(note(roots[bar], bar * 4 + i * 0.25, 0.2, 0.22, 'sawtooth'));
            }
          }
          return out;
        },
      },
      // Driving kick + hat
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            out.push(note('A0', i * 0.5, 0.25, 0.4, 'sine'));
            out.push(note('E6', i * 0.5 + 0.25, 0.06, 0.1, 'square'));
            if (i % 2 === 1) out.push(note('C6', i * 0.5, 0.1, 0.1, 'square'));
          }
          return out;
        },
      },
      // Stab chords
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const chords = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['E3', 'G3', 'B3']];
          for (let bar = 0; bar < 4; bar++) {
            const c = chords[bar];
            for (let i = 0; i < 4; i++) {
              c.forEach(n => out.push(note(n, bar * 4 + i, 0.3, 0.14, 'square')));
            }
          }
          return out;
        },
      },
      // High-energy lead
      {
        bars: 4,
        notes: () => [
          note('A4', 0, 0.25, 0.2, 'square'),
          note('E5', 0.25, 0.25, 0.2, 'square'),
          note('A5', 0.5, 0.25, 0.22, 'square'),
          note('E5', 0.75, 0.25, 0.2, 'square'),
          note('A5', 1, 0.5, 0.24, 'square'),
          note('G5', 1.5, 0.5, 0.22, 'square'),
          note('E5', 2, 0.5, 0.2, 'square'),
          note('D5', 2.5, 0.5, 0.2, 'square'),
          note('C5', 3, 0.5, 0.2, 'square'),
          note('A4', 3.5, 0.5, 0.2, 'square'),
          note('F5', 4, 0.5, 0.22, 'square'),
          note('A5', 4.5, 0.5, 0.24, 'square'),
          note('C6', 5, 0.5, 0.26, 'square'),
          note('A5', 5.5, 0.5, 0.22, 'square'),
          note('G5', 6, 0.25, 0.2, 'square'),
          note('F5', 6.25, 0.25, 0.2, 'square'),
          note('E5', 6.5, 0.5, 0.2, 'square'),
          note('D5', 7, 1, 0.22, 'square'),
          note('D5', 8, 0.25, 0.2, 'square'),
          note('A5', 8.25, 0.25, 0.22, 'square'),
          note('D6', 8.5, 0.5, 0.26, 'square'),
          note('A5', 9, 0.5, 0.22, 'square'),
          note('F5', 9.5, 0.5, 0.2, 'square'),
          note('D5', 10, 0.5, 0.2, 'square'),
          note('A4', 10.5, 0.5, 0.2, 'square'),
          note('G4', 11, 0.5, 0.18, 'square'),
          note('A4', 11.5, 0.5, 0.2, 'square'),
          note('B4', 12, 0.5, 0.2, 'square'),
          note('D5', 12.5, 0.5, 0.22, 'square'),
          note('E5', 13, 0.5, 0.22, 'square'),
          note('G5', 13.5, 0.5, 0.24, 'square'),
          note('A5', 14, 1, 0.26, 'square'),
          note('E5', 15, 1, 0.24, 'square'),
        ],
      },
    ],
  },
  // ── New match track: "Tungsten Storm" — intense rock ─────────────────
  {
    id: 'match_tungsten_storm',
    name: 'Tungsten Storm',
    context: 'match',
    bpm: 160,
    layers: [
      // Aggressive bass
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const roots = ['E1', 'E1', 'G1', 'A1'];
          for (let bar = 0; bar < 4; bar++) {
            for (let i = 0; i < 8; i++) {
              out.push(note(roots[bar], bar * 4 + i * 0.5, 0.4, 0.24, 'sawtooth'));
              if (i % 2 === 0) out.push(note(roots[bar].replace('1', '2'), bar * 4 + i * 0.5, 0.2, 0.16, 'square'));
            }
          }
          return out;
        },
      },
      // Heavy kick + snare
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let bar = 0; bar < 4; bar++) {
            for (let i = 0; i < 4; i++) {
              out.push(note('A0', bar * 4 + i, 0.35, 0.42, 'sine'));
              out.push(note('C6', bar * 4 + i + 1, 0.18, 0.18, 'square'));
              out.push(note('E6', bar * 4 + i + 0.5, 0.06, 0.1, 'square'));
              out.push(note('E6', bar * 4 + i + 1.5, 0.06, 0.1, 'square'));
            }
          }
          return out;
        },
      },
      // Power chord stabs
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const chords = [['E3', 'B3', 'E4'], ['E3', 'B3', 'E4'], ['G3', 'D4', 'G4'], ['A3', 'E4', 'A4']];
          for (let bar = 0; bar < 4; bar++) {
            const c = chords[bar];
            for (let i = 0; i < 4; i++) {
              c.forEach(n => out.push(note(n, bar * 4 + i * 0.5 + 0.5, 0.3, 0.16, 'sawtooth')));
            }
          }
          return out;
        },
      },
      // Shredding lead
      {
        bars: 4,
        notes: () => [
          note('E5', 0, 0.25, 0.22, 'square'),
          note('G5', 0.25, 0.25, 0.22, 'square'),
          note('B5', 0.5, 0.25, 0.24, 'square'),
          note('E6', 0.75, 0.25, 0.26, 'square'),
          note('B5', 1, 0.5, 0.24, 'square'),
          note('A5', 1.5, 0.5, 0.22, 'square'),
          note('G5', 2, 0.5, 0.22, 'square'),
          note('E5', 2.5, 0.5, 0.2, 'square'),
          note('D5', 3, 1, 0.22, 'square'),
          note('E5', 4, 0.25, 0.22, 'square'),
          note('G5', 4.25, 0.25, 0.22, 'square'),
          note('A5', 4.5, 0.25, 0.22, 'square'),
          note('B5', 4.75, 0.25, 0.24, 'square'),
          note('A5', 5, 0.5, 0.22, 'square'),
          note('G5', 5.5, 0.5, 0.22, 'square'),
          note('E5', 6, 0.5, 0.2, 'square'),
          note('D5', 6.5, 0.5, 0.2, 'square'),
          note('E5', 7, 1, 0.22, 'square'),
          note('G5', 8, 0.5, 0.22, 'square'),
          note('B5', 8.5, 0.5, 0.24, 'square'),
          note('D6', 9, 0.5, 0.26, 'square'),
          note('B5', 9.5, 0.5, 0.24, 'square'),
          note('A5', 10, 0.5, 0.22, 'square'),
          note('G5', 10.5, 0.5, 0.22, 'square'),
          note('E5', 11, 1, 0.22, 'square'),
          note('A5', 12, 0.25, 0.22, 'square'),
          note('B5', 12.25, 0.25, 0.22, 'square'),
          note('C6', 12.5, 0.25, 0.22, 'square'),
          note('D6', 12.75, 0.25, 0.24, 'square'),
          note('E6', 13, 1, 0.28, 'square'),
          note('B5', 14, 0.5, 0.24, 'square'),
          note('E5', 14.5, 0.5, 0.22, 'square'),
          note('E4', 15, 1, 0.24, 'square'),
        ],
      },
    ],
  },
];

const MUSIC_TRACKS: Track[] = [bullseyeAnthem, dartWarsTheme, ...setupTracks, ...matchTracks];

export function tracksFor(context: string): Track[] {
  return MUSIC_TRACKS.filter(t => t.context === context);
}

export function getTrack(trackId: string): Track | undefined {
  return MUSIC_TRACKS.find(t => t.id === trackId);
}

// Master output volume curve. Music used to peak at ~0.18 master gain, which
// is barely audible on a phone at max volume. We now push the master to ~0.9
// and route through a DynamicsCompressor limiter so layered notes don't clip.
function masterTarget(context: string): number {
  if (context === 'match') return 0.55;
  if (context === 'start') return 0.6;
  return 0.45;
}

export class MusicEngine {
  ctx: Ctx = null;
  master: GainNode | null = null;
  limiter: DynamicsCompressorNode | null = null;
  nodes: OscillatorNode[] = [];
  timers: ReturnType<typeof setTimeout>[] = [];
  track: string | null = null;
  unlocked = false;

  ensure(): Ctx {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { this.ctx = null; }
    }
    return this.ctx;
  }

  private buildOutput(ctx: AudioContext): GainNode {
    // Limiter so layered notes + boosted master don't clip into harsh distortion.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 12;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.limiter = comp;
    this.master = master;
    return master;
  }

  stop() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    const ctx = this.ctx;
    if (ctx && this.master) {
      const now = ctx.currentTime;
      try {
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(this.master.gain.value, now);
        this.master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      } catch {}
    }
    const nodesToKill = this.nodes;
    setTimeout(() => {
      nodesToKill.forEach(n => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} });
    }, 450);
    this.nodes = [];
    this.track = null;
  }

  trackFor(context: string, settings: Settings): Track | undefined {
    const chosenId = context === 'match'
      ? settings.musicMatchTrack
      : context === 'start'
        ? settings.musicStartTrack
        : settings.musicSetupTrack;
    return MUSIC_TRACKS.find(t => t.id === chosenId && t.context === context) || tracksFor(context)[0];
  }

  startContext(context: string, settings: Settings) {
    const t = this.trackFor(context, settings);
    if (t) this.start(t.id, settings);
  }

  start(trackId: string, settings: Settings) {
    if (!settings.music) return;
    const def = MUSIC_TRACKS.find(t => t.id === trackId);
    if (!def) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const wasSuspended = ctx.state === 'suspended';
    if (wasSuspended) {
      try { void ctx.resume(); } catch {}
    }
    if (this.track === trackId && !wasSuspended) return;
    this.stop();
    this.track = trackId;
    const master = this.buildOutput(ctx);
    const musicVol = settings.musicVolume ?? 0.8;
    const now = ctx.currentTime;
    master.gain.setValueAtTime(0.0001, now);
    const target = masterTarget(def.context) * musicVol;
    master.gain.linearRampToValueAtTime(target, now + 1.0);
    this.playTrack(def, ctx);
  }

  // Preview a track from settings (does not require the global music toggle).
  preview(trackId: string, settings: Settings) {
    const def = MUSIC_TRACKS.find(t => t.id === trackId);
    if (!def) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { void ctx.resume(); } catch {} }
    this.stop();
    this.track = trackId;
    const master = this.buildOutput(ctx);
    const musicVol = settings.musicVolume ?? 0.8;
    const now = ctx.currentTime;
    master.gain.setValueAtTime(0.0001, now);
    const target = masterTarget(def.context) * musicVol;
    master.gain.linearRampToValueAtTime(target, now + 0.25);
    this.playTrack(def, ctx);
  }

  private playTrack(def: Track, ctx: AudioContext) {
    const spb = 60 / def.bpm; // seconds per beat
    const loopBeats = def.layers.reduce((m, l) => Math.max(m, l.bars * 4), 0);
    const loopDur = loopBeats * spb;
    const schedule = (cycle: number) => {
      if (this.track !== def.id) return;
      const t0 = ctx.currentTime + 0.05;
      def.layers.forEach((layer) => {
        const seqData = layer.notes([], cycle);
        seqData.forEach((n) => {
          if (!n.f) return;
          const startSec = t0 + n.start * spb;
          const durSec = n.dur * spb;
          this.tone(ctx, n.f, startSec, durSec, n.wave ?? 'triangle', n.gain ?? 0.18);
        });
      });
      this.timers.push(setTimeout(() => schedule(cycle + 1), loopDur * 1000));
    };
    schedule(0);
  }

  tone(ctx: AudioContext, freq: number, start: number, dur: number, wave: OscillatorType, gain: number) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(this.master!);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start);
    o.stop(start + dur + 0.05);
    this.nodes.push(o);
  }
}
