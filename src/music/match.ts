import { type Note, type Track, note } from './types';

export const matchTracks: Track[] = [
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
