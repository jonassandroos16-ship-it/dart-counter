import { type Note, type Track, note } from './types';

export const setupTracks: Track[] = [
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
