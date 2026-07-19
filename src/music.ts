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

const note = (name: string, start: number, dur: number, gain = 0.06, wave: Wave = 'triangle'): Note => ({
  f: N[name] ?? 0, start, dur, gain, wave,
});

// Epic "Dart Wars" theme — minor key, driving ostinato, heroic melody.
const dartWarsTheme: Track = {
  id: 'start_dart_wars',
  name: 'Dart Wars Theme',
  context: 'start',
  bpm: 132,
  layers: [
    // Bass ostinato — drives the whole piece, 8 bars
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let bar = 0; bar < 8; bar++) {
          const root = bar < 2 || (bar >= 4 && bar < 6) ? 'A1' : 'F1';
          for (let i = 0; i < 8; i++) {
            const name = i === 0 || i === 4 ? root : (bar < 2 || (bar >= 4 && bar < 6) ? 'A2' : 'F2');
            out.push(note(name, bar * 8 + i, 0.5, 0.08, 'sawtooth'));
          }
        }
        return out;
      },
    },
    // Sub-kick pulse
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let i = 0; i < 64; i++) {
          if (i % 2 === 0) out.push(note('A0', i, 0.4, 0.16, 'sine'));
        }
        return out;
      },
    },
    // Snare/hat on offbeats
    {
      bars: 8,
      notes: () => {
        const out: Note[] = [];
        for (let i = 0; i < 64; i++) {
          if (i % 2 === 1) out.push(note('C6', i + 0.5, 0.12, 0.025, 'square'));
        }
        return out;
      },
    },
    // Heroic lead melody — 16 bars, A minor with a triumphant climb
    {
      bars: 8,
      notes: () => [
        note('E4', 0, 1, 0.07, 'square'),
        note('G4', 1, 0.5, 0.07, 'square'),
        note('A4', 1.5, 1.5, 0.08, 'square'),
        note('B4', 3, 0.5, 0.07, 'square'),
        note('C5', 3.5, 0.5, 0.07, 'square'),
        note('B4', 4, 1, 0.07, 'square'),
        note('A4', 5, 0.5, 0.07, 'square'),
        note('G4', 5.5, 0.5, 0.07, 'square'),
        note('E4', 6, 1, 0.07, 'square'),
        note('D4', 7, 1, 0.07, 'square'),
        note('E4', 8, 0.5, 0.07, 'square'),
        note('G4', 8.5, 0.5, 0.07, 'square'),
        note('A4', 9, 0.5, 0.07, 'square'),
        note('B4', 9.5, 0.5, 0.07, 'square'),
        note('C5', 10, 1, 0.08, 'square'),
        note('D5', 11, 0.5, 0.07, 'square'),
        note('E5', 11.5, 1.5, 0.09, 'square'),
        note('D5', 13, 0.5, 0.07, 'square'),
        note('C5', 13.5, 0.5, 0.07, 'square'),
        note('B4', 14, 1, 0.07, 'square'),
        note('A4', 15, 1, 0.08, 'square'),
        note('C5', 16, 1, 0.08, 'square'),
        note('B4', 17, 0.5, 0.07, 'square'),
        note('A4', 17.5, 0.5, 0.07, 'square'),
        note('G4', 18, 1, 0.07, 'square'),
        note('A4', 19, 1, 0.07, 'square'),
        note('F4', 20, 1, 0.07, 'square'),
        note('E4', 21, 0.5, 0.07, 'square'),
        note('D4', 21.5, 0.5, 0.07, 'square'),
        note('E4', 22, 2, 0.08, 'square'),
        note('A4', 24, 1, 0.08, 'square'),
        note('G4', 25, 0.5, 0.07, 'square'),
        note('F4', 25.5, 0.5, 0.07, 'square'),
        note('E4', 26, 1, 0.07, 'square'),
        note('F4', 27, 1, 0.07, 'square'),
        note('D4', 28, 0.5, 0.07, 'square'),
        note('E4', 28.5, 0.5, 0.07, 'square'),
        note('F4', 29, 0.5, 0.07, 'square'),
        note('G4', 29.5, 0.5, 0.07, 'square'),
        note('A4', 30, 1, 0.08, 'square'),
        note('B4', 31, 0.5, 0.07, 'square'),
        note('C5', 31.5, 0.5, 0.07, 'square'),
        note('A4', 32, 2, 0.08, 'square'),
        note('E5', 32, 1, 0.08, 'square'),
        note('D5', 33, 0.5, 0.07, 'square'),
        note('C5', 33.5, 0.5, 0.07, 'square'),
        note('B4', 34, 1, 0.07, 'square'),
        note('A4', 35, 1, 0.07, 'square'),
        note('G4', 36, 0.5, 0.07, 'square'),
        note('A4', 36.5, 0.5, 0.07, 'square'),
        note('B4', 37, 0.5, 0.07, 'square'),
        note('C5', 37.5, 0.5, 0.07, 'square'),
        note('D5', 38, 1, 0.07, 'square'),
        note('E5', 39, 1, 0.08, 'square'),
        note('F5', 40, 1.5, 0.09, 'square'),
        note('E5', 41.5, 0.5, 0.07, 'square'),
        note('D5', 42, 1, 0.07, 'square'),
        note('C5', 43, 1, 0.07, 'square'),
        note('B4', 44, 0.5, 0.07, 'square'),
        note('A4', 44.5, 0.5, 0.07, 'square'),
        note('G4', 45, 0.5, 0.07, 'square'),
        note('F4', 45.5, 0.5, 0.07, 'square'),
        note('E4', 46, 2, 0.08, 'square'),
        note('A4', 48, 1, 0.08, 'square'),
        note('G4', 49, 0.5, 0.07, 'square'),
        note('F4', 49.5, 0.5, 0.07, 'square'),
        note('E4', 50, 1, 0.07, 'square'),
        note('D4', 51, 1, 0.07, 'square'),
        note('C4', 52, 0.5, 0.07, 'square'),
        note('D4', 52.5, 0.5, 0.07, 'square'),
        note('E4', 53, 0.5, 0.07, 'square'),
        note('F4', 53.5, 0.5, 0.07, 'square'),
        note('E4', 54, 2, 0.08, 'square'),
        note('A4', 56, 1, 0.08, 'square'),
        note('C5', 57, 1, 0.08, 'square'),
        note('E5', 58, 2, 0.09, 'square'),
        note('A5', 60, 4, 0.1, 'square'),
      ],
    },
    // Harmony pad — sustained chords under the melody
    {
      bars: 8,
      notes: () => [
        { ...note('A2', 0, 4, 0.04, 'sine') },
        { ...note('A3', 0, 4, 0.035, 'sine') },
        { ...note('E3', 0, 4, 0.03, 'sine') },
        { ...note('F2', 4, 4, 0.04, 'sine') },
        { ...note('F3', 4, 4, 0.035, 'sine') },
        { ...note('C3', 4, 4, 0.03, 'sine') },
        { ...note('A2', 8, 4, 0.04, 'sine') },
        { ...note('E3', 8, 4, 0.03, 'sine') },
        { ...note('A3', 8, 4, 0.035, 'sine') },
        { ...note('E3', 12, 4, 0.04, 'sine') },
        { ...note('B3', 12, 4, 0.03, 'sine') },
        { ...note('G3', 12, 4, 0.03, 'sine') },
        { ...note('C3', 16, 4, 0.04, 'sine') },
        { ...note('G3', 16, 4, 0.035, 'sine') },
        { ...note('E3', 16, 4, 0.03, 'sine') },
        { ...note('F2', 20, 4, 0.04, 'sine') },
        { ...note('A3', 20, 4, 0.035, 'sine') },
        { ...note('C3', 20, 4, 0.03, 'sine') },
        { ...note('D3', 24, 4, 0.04, 'sine') },
        { ...note('A3', 24, 4, 0.035, 'sine') },
        { ...note('F3', 24, 4, 0.03, 'sine') },
        { ...note('A2', 28, 4, 0.045, 'sine') },
        { ...note('E3', 28, 4, 0.035, 'sine') },
        { ...note('A3', 28, 4, 0.04, 'sine') },
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
      // Slow chord progression — 4 chords, 2 bars each (8 bars total)
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
              out.push({ ...note(n, ci * 8, 8, 0.04, 'sine') });
              if (ni === 0) out.push({ ...note(n, ci * 8, 8, 0.05, 'triangle') });
            });
          });
          return out;
        },
      },
      // Gentle arpeggio
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
              out.push(note(n, ci * 8 + i * 0.25, 0.22, 0.04, 'triangle'));
            }
          });
          return out;
        },
      },
      // Soft melody on top — 8-bar phrase
      {
        bars: 8,
        notes: () => [
          note('C5', 0, 1.5, 0.05, 'sine'),
          note('D5', 1.5, 0.5, 0.045, 'sine'),
          note('F5', 2, 1.5, 0.05, 'sine'),
          note('E5', 3.5, 0.5, 0.045, 'sine'),
          note('G4', 4, 1, 0.05, 'sine'),
          note('E4', 5, 1, 0.045, 'sine'),
          note('F4', 6, 2, 0.05, 'sine'),
          note('A4', 8, 1.5, 0.05, 'sine'),
          note('G4', 9.5, 0.5, 0.045, 'sine'),
          note('E4', 10, 1.5, 0.05, 'sine'),
          note('D4', 11.5, 0.5, 0.045, 'sine'),
          note('C4', 12, 2, 0.05, 'sine'),
          note('E4', 14, 2, 0.05, 'sine'),
          note('F5', 16, 1.5, 0.05, 'sine'),
          note('G5', 17.5, 0.5, 0.045, 'sine'),
          note('A5', 18, 1.5, 0.05, 'sine'),
          note('G5', 19.5, 0.5, 0.045, 'sine'),
          note('E5', 20, 1, 0.05, 'sine'),
          note('C5', 21, 1, 0.045, 'sine'),
          note('D5', 22, 2, 0.05, 'sine'),
          note('F4', 24, 1.5, 0.05, 'sine'),
          note('E5', 25.5, 0.5, 0.045, 'sine'),
          note('D5', 26, 1.5, 0.05, 'sine'),
          note('C5', 27.5, 0.5, 0.045, 'sine'),
          note('A4', 28, 2, 0.05, 'sine'),
          note('F4', 30, 2, 0.05, 'sine'),
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
      // Marimba-style arpeggio
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
              out.push(note(n, ci * 4 + i * 0.5, 0.4, 0.06, 'triangle'));
            }
          });
          return out;
        },
      },
      // Bass marimba
      {
        bars: 4,
        notes: () => [
          note('E2', 0, 4, 0.05, 'sine'),
          note('C3', 4, 4, 0.05, 'sine'),
          note('A2', 8, 4, 0.05, 'sine'),
          note('B2', 12, 4, 0.05, 'sine'),
        ],
      },
      // Melodic phrase
      {
        bars: 4,
        notes: () => [
          note('B4', 0, 0.5, 0.05, 'triangle'),
          note('D5', 0.5, 0.5, 0.05, 'triangle'),
          note('E5', 1, 0.5, 0.05, 'triangle'),
          note('D5', 1.5, 0.5, 0.05, 'triangle'),
          note('G4', 2, 1, 0.05, 'triangle'),
          note('E4', 3, 1, 0.05, 'triangle'),
          note('C5', 4, 0.5, 0.05, 'triangle'),
          note('E5', 4.5, 0.5, 0.05, 'triangle'),
          note('G5', 5, 0.5, 0.05, 'triangle'),
          note('E5', 5.5, 0.5, 0.05, 'triangle'),
          note('D5', 6, 1, 0.05, 'triangle'),
          note('B4', 7, 1, 0.05, 'triangle'),
          note('A4', 8, 0.5, 0.05, 'triangle'),
          note('C5', 8.5, 0.5, 0.05, 'triangle'),
          note('E5', 9, 0.5, 0.05, 'triangle'),
          note('C5', 9.5, 0.5, 0.05, 'triangle'),
          note('B4', 10, 1, 0.05, 'triangle'),
          note('G4', 11, 1, 0.05, 'triangle'),
          note('D5', 12, 0.5, 0.05, 'triangle'),
          note('F5', 12.5, 0.5, 0.05, 'triangle'),
          note('A5', 13, 0.5, 0.05, 'triangle'),
          note('G5', 13.5, 0.5, 0.05, 'triangle'),
          note('F5', 14, 1, 0.05, 'triangle'),
          note('D5', 15, 1, 0.05, 'triangle'),
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
      // Warm chord pad — 4 chords, 2 bars each (8 bars total)
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
            chord.forEach((n) => out.push({ ...note(n, ci * 8, 8, 0.04, 'sine') }));
          });
          return out;
        },
      },
      // Lo-fi beat
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            if (i % 4 === 0) out.push(note('A0', i, 0.4, 0.12, 'sine'));
            if (i % 4 === 2) out.push(note('C6', i + 0.5, 0.15, 0.03, 'square'));
          }
          return out;
        },
      },
      // Sleepy melody — 8-bar phrase
      {
        bars: 8,
        notes: () => [
          note('A4', 0, 1, 0.045, 'triangle'),
          note('C5', 1, 1, 0.045, 'triangle'),
          note('A4', 2, 2, 0.045, 'triangle'),
          note('G4', 4, 1, 0.045, 'triangle'),
          note('B4', 5, 1, 0.045, 'triangle'),
          note('G4', 6, 2, 0.045, 'triangle'),
          note('F4', 8, 1, 0.045, 'triangle'),
          note('A4', 9, 1, 0.045, 'triangle'),
          note('F4', 10, 2, 0.045, 'triangle'),
          note('E4', 12, 2, 0.045, 'triangle'),
          note('G4', 14, 2, 0.045, 'triangle'),
          note('C5', 16, 1, 0.045, 'triangle'),
          note('E5', 17, 1, 0.045, 'triangle'),
          note('C5', 18, 2, 0.045, 'triangle'),
          note('B4', 20, 1, 0.045, 'triangle'),
          note('D5', 21, 1, 0.045, 'triangle'),
          note('B4', 22, 2, 0.045, 'triangle'),
          note('A4', 24, 1, 0.045, 'triangle'),
          note('F4', 25, 1, 0.045, 'triangle'),
          note('A4', 26, 2, 0.045, 'triangle'),
          note('G4', 28, 2, 0.045, 'triangle'),
          note('F4', 30, 2, 0.045, 'triangle'),
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
      // Driving bass
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const roots = ['A1', 'A1', 'F1', 'G1'];
          for (let bar = 0; bar < 4; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 8; i++) {
              out.push(note(r, bar * 4 + i * 0.5, 0.4, 0.09, 'sawtooth'));
            }
          }
          return out;
        },
      },
      // Kick + hat
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            if (i % 2 === 0) out.push(note('A0', i * 0.5, 0.3, 0.14, 'sine'));
            out.push(note('C6', i * 0.5 + 0.25, 0.1, 0.02, 'square'));
          }
          return out;
        },
      },
      // Lead melody
      {
        bars: 4,
        notes: () => [
          note('A4', 0, 0.5, 0.05, 'square'),
          note('C5', 0.5, 0.5, 0.05, 'square'),
          note('E5', 1, 0.5, 0.05, 'square'),
          note('A5', 1.5, 0.5, 0.05, 'square'),
          note('G5', 2, 0.5, 0.05, 'square'),
          note('E5', 2.5, 0.5, 0.05, 'square'),
          note('D5', 3, 0.5, 0.05, 'square'),
          note('C5', 3.5, 0.5, 0.05, 'square'),
          note('F5', 4, 0.5, 0.05, 'square'),
          note('A5', 4.5, 0.5, 0.05, 'square'),
          note('C6', 5, 0.5, 0.05, 'square'),
          note('A5', 5.5, 0.5, 0.05, 'square'),
          note('G5', 6, 0.5, 0.05, 'square'),
          note('F5', 6.5, 0.5, 0.05, 'square'),
          note('E5', 7, 1, 0.05, 'square'),
          note('D5', 8, 0.5, 0.05, 'square'),
          note('E5', 8.5, 0.5, 0.05, 'square'),
          note('F5', 9, 0.5, 0.05, 'square'),
          note('E5', 9.5, 0.5, 0.05, 'square'),
          note('D5', 10, 0.5, 0.05, 'square'),
          note('C5', 10.5, 0.5, 0.05, 'square'),
          note('A4', 11, 1, 0.05, 'square'),
          note('G4', 12, 0.5, 0.05, 'square'),
          note('A4', 12.5, 0.5, 0.05, 'square'),
          note('C5', 13, 0.5, 0.05, 'square'),
          note('E5', 13.5, 0.5, 0.05, 'square'),
          note('A5', 14, 1, 0.06, 'square'),
          note('A4', 15, 1, 0.06, 'square'),
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
      // Stab chords on offbeats
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
              chord.forEach((n) => out.push(note(n, bar * 4 + i + 0.5, 0.4, 0.04, 'square')));
            }
          }
          return out;
        },
      },
      // Kick drum
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 16; i++) {
            if (i % 2 === 0) out.push(note('A0', i, 0.35, 0.15, 'sine'));
            else out.push(note('C6', i, 0.12, 0.03, 'square'));
          }
          return out;
        },
      },
      // Bass
      {
        bars: 4,
        notes: () => {
          const roots = ['D1', 'C1', 'B0', 'A0'];
          const out: Note[] = [];
          for (let bar = 0; bar < 4; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 4; i++) out.push(note(r, bar * 4 + i, 0.9, 0.08, 'sawtooth'));
          }
          return out;
        },
      },
      // Lead fanfare
      {
        bars: 4,
        notes: () => [
          note('D5', 0, 0.5, 0.06, 'square'),
          note('F5', 0.5, 0.5, 0.06, 'square'),
          note('A5', 1, 1, 0.07, 'square'),
          note('A5', 2, 0.5, 0.06, 'square'),
          note('G5', 2.5, 0.5, 0.06, 'square'),
          note('F5', 3, 1, 0.06, 'square'),
          note('C5', 4, 0.5, 0.06, 'square'),
          note('E5', 4.5, 0.5, 0.06, 'square'),
          note('A5', 5, 1, 0.07, 'square'),
          note('G5', 6, 0.5, 0.06, 'square'),
          note('E5', 6.5, 0.5, 0.06, 'square'),
          note('C5', 7, 1, 0.06, 'square'),
          note('B4', 8, 0.5, 0.06, 'square'),
          note('D5', 8.5, 0.5, 0.06, 'square'),
          note('G5', 9, 1, 0.07, 'square'),
          note('A5', 10, 0.5, 0.06, 'square'),
          note('G5', 10.5, 0.5, 0.06, 'square'),
          note('F5', 11, 1, 0.06, 'square'),
          note('A4', 12, 0.5, 0.06, 'square'),
          note('C5', 12.5, 0.5, 0.06, 'square'),
          note('E5', 13, 1, 0.07, 'square'),
          note('A5', 14, 1, 0.07, 'square'),
          note('A4', 15, 1, 0.07, 'square'),
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
      // Pulsing bass
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            out.push(note('A1', i * 0.5, 0.4, 0.08, 'sawtooth'));
            if (i % 4 === 2) out.push(note('E2', i * 0.5, 0.4, 0.07, 'sawtooth'));
          }
          return out;
        },
      },
      // Pulse chord
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          const chords = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['D3', 'F3', 'A3'], ['E3', 'G3', 'B3']];
          for (let bar = 0; bar < 4; bar++) {
            const c = chords[bar];
            for (let i = 0; i < 8; i++) {
              if (i % 2 === 0) c.forEach((n) => out.push(note(n, bar * 4 + i * 0.5, 0.35, 0.03, 'square')));
            }
          }
          return out;
        },
      },
      // Driving kick
      {
        bars: 4,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 32; i++) {
            out.push(note('A0', i * 0.5, 0.25, 0.13, 'sine'));
            out.push(note('C6', i * 0.5 + 0.25, 0.08, 0.02, 'square'));
          }
          return out;
        },
      },
      // Arpeggiated lead
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
              out.push(note(arp[i % arp.length], ci * 4 + i * 0.25, 0.22, 0.05, 'square'));
            }
          });
          return out;
        },
      },
    ],
  },
];

const MUSIC_TRACKS: Track[] = [dartWarsTheme, ...setupTracks, ...matchTracks];

export function tracksFor(context: string): Track[] {
  return MUSIC_TRACKS.filter(t => t.context === context);
}

export class MusicEngine {
  ctx: Ctx = null;
  master: GainNode | null = null;
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
    if (this.track === trackId) return;
    this.stop();
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume();
      if (ctx.state === 'suspended') { this.track = null; return; }
    }
    this.track = trackId;
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    const target = def.context === 'match' ? 0.16 : def.context === 'start' ? 0.18 : 0.10;
    this.master.gain.linearRampToValueAtTime(target, ctx.currentTime + 1.2);
    this.master.connect(ctx.destination);
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
          this.tone(ctx, n.f, startSec, durSec, n.wave ?? 'triangle', n.gain ?? 0.06);
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
