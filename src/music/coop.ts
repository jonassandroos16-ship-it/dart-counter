import { type Note, type Track, note } from './types';

// Coop campaign tracks — heroic, driving, but slightly more atmospheric
// than the competitive match tracks to suit a campaign vibe.

export const coopTracks: Track[] = [
  {
    id: 'coop_siege',
    name: 'Siege Engine',
    context: 'coop',
    bpm: 130,
    layers: [
      // Pulsing campaign bass — root-fifth, 8 bars
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          const roots = ['D1', 'D1', 'D1', 'A1', 'B1', 'B1', 'G1', 'A1'];
          for (let bar = 0; bar < 8; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 8; i++) {
              out.push(note(r, bar * 4 + i * 0.5, 0.4, 0.22, 'sawtooth'));
            }
          }
          return out;
        },
      },
      // Driving kick + snare + hat
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          for (let bar = 0; bar < 8; bar++) {
            for (let i = 0; i < 4; i++) {
              const t = bar * 4 + i;
              out.push(note('A0', t, 0.35, 0.42, 'sine'));
              if (i === 1 || i === 3) out.push(note('C6', t, 0.18, 0.16, 'square'));
              out.push(note('E6', t + 0.5, 0.08, 0.08, 'square'));
            }
          }
          return out;
        },
      },
      // Heroic brass-style melody — D minor campaign theme, 8 bars
      {
        bars: 8,
        notes: () => [
          note('D4', 0, 0.75, 0.26, 'square'),
          note('F4', 0.75, 0.25, 0.22, 'square'),
          note('A4', 1, 0.75, 0.28, 'square'),
          note('D5', 1.75, 0.25, 0.24, 'square'),
          note('C5', 2, 0.5, 0.26, 'square'),
          note('A4', 2.5, 0.5, 0.24, 'square'),
          note('F4', 3, 1, 0.26, 'square'),
          note('A4', 4, 0.5, 0.26, 'square'),
          note('G4', 4.5, 0.5, 0.24, 'square'),
          note('F4', 5, 0.5, 0.26, 'square'),
          note('E4', 5.5, 0.5, 0.24, 'square'),
          note('D4', 6, 1, 0.28, 'square'),
          note('A3', 7, 1, 0.26, 'square'),
          note('D5', 8, 0.75, 0.28, 'square'),
          note('F5', 8.75, 0.25, 0.24, 'square'),
          note('A5', 9, 0.75, 0.3, 'square'),
          note('G5', 9.75, 0.25, 0.24, 'square'),
          note('F5', 10, 0.5, 0.26, 'square'),
          note('E5', 10.5, 0.5, 0.24, 'square'),
          note('D5', 11, 1, 0.28, 'square'),
          note('B4', 12, 0.5, 0.26, 'square'),
          note('D5', 12.5, 0.5, 0.26, 'square'),
          note('G5', 13, 1, 0.28, 'square'),
          note('F5', 14, 1, 0.26, 'square'),
          note('E5', 16, 0.5, 0.26, 'square'),
          note('D5', 16.5, 0.5, 0.24, 'square'),
          note('C5', 17, 0.5, 0.26, 'square'),
          note('A4', 17.5, 0.5, 0.24, 'square'),
          note('B4', 18, 1, 0.28, 'square'),
          note('G4', 19, 1, 0.26, 'square'),
          note('A4', 20, 0.5, 0.26, 'square'),
          note('B4', 20.5, 0.5, 0.24, 'square'),
          note('C5', 21, 0.5, 0.26, 'square'),
          note('D5', 21.5, 0.5, 0.28, 'square'),
          note('E5', 22, 1, 0.3, 'square'),
          note('D5', 23, 1, 0.26, 'square'),
          note('F5', 24, 0.75, 0.28, 'square'),
          note('E5', 24.75, 0.25, 0.24, 'square'),
          note('D5', 25, 0.75, 0.28, 'square'),
          note('C5', 25.75, 0.25, 0.24, 'square'),
          note('B4', 26, 0.5, 0.26, 'square'),
          note('A4', 26.5, 0.5, 0.24, 'square'),
          note('G4', 27, 1, 0.26, 'square'),
          note('A4', 28, 0.5, 0.26, 'square'),
          note('D5', 28.5, 0.5, 0.28, 'square'),
          note('F5', 29, 1, 0.3, 'square'),
          note('E5', 30, 1, 0.28, 'square'),
          note('D5', 31, 1, 0.3, 'square'),
        ],
      },
      // Sustained pad
      {
        bars: 8,
        notes: () => [
          { ...note('D2', 0, 4, 0.14, 'sine') },
          { ...note('A3', 0, 4, 0.1, 'sine') },
          { ...note('D3', 0, 4, 0.08, 'sine') },
          { ...note('A1', 4, 4, 0.14, 'sine') },
          { ...note('E3', 4, 4, 0.1, 'sine') },
          { ...note('B2', 8, 4, 0.14, 'sine') },
          { ...note('G3', 8, 4, 0.1, 'sine') },
          { ...note('G1', 12, 4, 0.14, 'sine') },
          { ...note('D3', 12, 4, 0.1, 'sine') },
          { ...note('D2', 16, 4, 0.14, 'sine') },
          { ...note('A3', 16, 4, 0.1, 'sine') },
          { ...note('A1', 20, 4, 0.14, 'sine') },
          { ...note('E3', 20, 4, 0.1, 'sine') },
          { ...note('G1', 24, 4, 0.14, 'sine') },
          { ...note('D3', 24, 4, 0.1, 'sine') },
          { ...note('A1', 28, 4, 0.14, 'sine') },
          { ...note('E3', 28, 4, 0.1, 'sine') },
        ],
      },
    ],
  },
  {
    id: 'coop_banner',
    name: 'Banner Raised',
    context: 'coop',
    bpm: 118,
    layers: [
      // Marching bass
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          const roots = ['C1', 'C1', 'G1', 'A1', 'F1', 'F1', 'C1', 'G1'];
          for (let bar = 0; bar < 8; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 4; i++) {
              out.push(note(r, bar * 4 + i, 0.8, 0.2, 'sawtooth'));
            }
          }
          return out;
        },
      },
      // Steady march beat
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          for (let bar = 0; bar < 8; bar++) {
            for (let i = 0; i < 4; i++) {
              const t = bar * 4 + i;
              out.push(note('A0', t, 0.3, 0.4, 'sine'));
              if (i === 0 || i === 2) out.push(note('C6', t + 0.5, 0.12, 0.12, 'square'));
              out.push(note('E6', t + 1, 0.06, 0.08, 'square'));
            }
          }
          return out;
        },
      },
      // Triumphant C major melody
      {
        bars: 8,
        notes: () => [
          note('C5', 0, 1, 0.26, 'square'),
          note('E5', 1, 0.5, 0.24, 'square'),
          note('G5', 1.5, 0.5, 0.26, 'square'),
          note('C6', 2, 1, 0.3, 'square'),
          note('B5', 3, 1, 0.26, 'square'),
          note('G5', 4, 1, 0.26, 'square'),
          note('A5', 5, 0.5, 0.24, 'square'),
          note('G5', 5.5, 0.5, 0.22, 'square'),
          note('F5', 6, 1, 0.26, 'square'),
          note('E5', 7, 1, 0.24, 'square'),
          note('D5', 8, 0.5, 0.24, 'square'),
          note('E5', 8.5, 0.5, 0.24, 'square'),
          note('F5', 9, 1, 0.26, 'square'),
          note('G5', 10, 1, 0.28, 'square'),
          note('A5', 11, 1, 0.26, 'square'),
          note('G5', 12, 0.5, 0.26, 'square'),
          note('F5', 12.5, 0.5, 0.24, 'square'),
          note('E5', 13, 0.5, 0.24, 'square'),
          note('D5', 13.5, 0.5, 0.22, 'square'),
          note('C5', 14, 1, 0.28, 'square'),
          note('G4', 15, 1, 0.24, 'square'),
          note('C5', 16, 1, 0.26, 'square'),
          note('E5', 17, 0.5, 0.24, 'square'),
          note('G5', 17.5, 0.5, 0.26, 'square'),
          note('A5', 18, 1, 0.28, 'square'),
          note('G5', 19, 1, 0.26, 'square'),
          note('F5', 20, 1, 0.26, 'square'),
          note('E5', 21, 0.5, 0.24, 'square'),
          note('D5', 21.5, 0.5, 0.22, 'square'),
          note('C5', 22, 1, 0.28, 'square'),
          note('D5', 23, 1, 0.24, 'square'),
          note('E5', 24, 0.5, 0.24, 'square'),
          note('F5', 24.5, 0.5, 0.26, 'square'),
          note('G5', 25, 1, 0.28, 'square'),
          note('A5', 26, 1, 0.3, 'square'),
          note('G5', 27, 1, 0.26, 'square'),
          note('C6', 28, 1.5, 0.32, 'square'),
          note('B5', 29.5, 0.5, 0.26, 'square'),
          note('G5', 30, 1, 0.28, 'square'),
          note('C5', 31, 1, 0.3, 'square'),
        ],
      },
      // Warm pad
      {
        bars: 8,
        notes: () => [
          { ...note('C2', 0, 4, 0.14, 'sine') },
          { ...note('G3', 0, 4, 0.1, 'sine') },
          { ...note('C3', 0, 4, 0.08, 'sine') },
          { ...note('G1', 4, 4, 0.14, 'sine') },
          { ...note('D3', 4, 4, 0.1, 'sine') },
          { ...note('F1', 8, 4, 0.14, 'sine') },
          { ...note('C3', 8, 4, 0.1, 'sine') },
          { ...note('C1', 12, 4, 0.14, 'sine') },
          { ...note('G3', 12, 4, 0.1, 'sine') },
          { ...note('C2', 16, 4, 0.14, 'sine') },
          { ...note('G3', 16, 4, 0.1, 'sine') },
          { ...note('G1', 20, 4, 0.14, 'sine') },
          { ...note('D3', 20, 4, 0.1, 'sine') },
          { ...note('F1', 24, 4, 0.14, 'sine') },
          { ...note('C3', 24, 4, 0.1, 'sine') },
          { ...note('G1', 28, 4, 0.14, 'sine') },
          { ...note('D3', 28, 4, 0.1, 'sine') },
        ],
      },
    ],
  },
  {
    id: 'coop_deep_raid',
    name: 'Deep Raid',
    context: 'coop',
    bpm: 138,
    layers: [
      // Dark driving bass
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          const roots = ['E1', 'E1', 'C1', 'D1', 'E1', 'E1', 'C1', 'D1'];
          for (let bar = 0; bar < 8; bar++) {
            const r = roots[bar];
            for (let i = 0; i < 8; i++) {
              out.push(note(r, bar * 4 + i * 0.5, 0.35, 0.24, 'sawtooth'));
            }
          }
          return out;
        },
      },
      // Relentless beat
      {
        bars: 8,
        notes: () => {
          const out: Note[] = [];
          for (let i = 0; i < 64; i++) {
            out.push(note('A0', i * 0.5, 0.25, 0.4, 'sine'));
            out.push(note('E6', i * 0.5 + 0.25, 0.06, 0.1, 'square'));
            if (i % 2 === 1) out.push(note('C6', i * 0.5, 0.1, 0.12, 'square'));
          }
          return out;
        },
      },
      // Minor-key tension melody
      {
        bars: 8,
        notes: () => [
          note('E4', 0, 0.5, 0.22, 'square'),
          note('G4', 0.5, 0.5, 0.22, 'square'),
          note('B4', 1, 0.5, 0.24, 'square'),
          note('E5', 1.5, 0.5, 0.26, 'square'),
          note('D5', 2, 0.5, 0.24, 'square'),
          note('B4', 2.5, 0.5, 0.22, 'square'),
          note('G4', 3, 1, 0.24, 'square'),
          note('A4', 4, 0.5, 0.22, 'square'),
          note('B4', 4.5, 0.5, 0.24, 'square'),
          note('C5', 5, 0.5, 0.24, 'square'),
          note('D5', 5.5, 0.5, 0.26, 'square'),
          note('E5', 6, 1, 0.28, 'square'),
          note('B4', 7, 1, 0.24, 'square'),
          note('C5', 8, 0.5, 0.24, 'square'),
          note('D5', 8.5, 0.5, 0.24, 'square'),
          note('E5', 9, 0.5, 0.26, 'square'),
          note('F5', 9.5, 0.5, 0.26, 'square'),
          note('E5', 10, 0.5, 0.28, 'square'),
          note('D5', 10.5, 0.5, 0.24, 'square'),
          note('C5', 11, 1, 0.24, 'square'),
          note('B4', 12, 0.5, 0.22, 'square'),
          note('A4', 12.5, 0.5, 0.22, 'square'),
          note('G4', 13, 1, 0.24, 'square'),
          note('A4', 14, 1, 0.22, 'square'),
          note('E4', 15, 1, 0.24, 'square'),
          note('E5', 16, 0.5, 0.26, 'square'),
          note('D5', 16.5, 0.5, 0.24, 'square'),
          note('C5', 17, 0.5, 0.24, 'square'),
          note('B4', 17.5, 0.5, 0.22, 'square'),
          note('A4', 18, 0.5, 0.22, 'square'),
          note('G4', 18.5, 0.5, 0.22, 'square'),
          note('A4', 19, 1, 0.24, 'square'),
          note('B4', 20, 0.5, 0.22, 'square'),
          note('C5', 20.5, 0.5, 0.24, 'square'),
          note('D5', 21, 0.5, 0.24, 'square'),
          note('E5', 21.5, 0.5, 0.26, 'square'),
          note('F5', 22, 1, 0.28, 'square'),
          note('E5', 23, 1, 0.26, 'square'),
          note('D5', 24, 0.5, 0.24, 'square'),
          note('C5', 24.5, 0.5, 0.24, 'square'),
          note('B4', 25, 0.5, 0.22, 'square'),
          note('A4', 25.5, 0.5, 0.22, 'square'),
          note('G4', 26, 1, 0.24, 'square'),
          note('A4', 27, 1, 0.22, 'square'),
          note('B4', 28, 0.5, 0.22, 'square'),
          note('C5', 28.5, 0.5, 0.24, 'square'),
          note('D5', 29, 0.5, 0.24, 'square'),
          note('E5', 29.5, 0.5, 0.26, 'square'),
          note('D5', 30, 1, 0.26, 'square'),
          note('E4', 31, 1, 0.28, 'square'),
        ],
      },
    ],
  },
];
