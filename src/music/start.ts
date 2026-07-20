import { type Note, type Track, note } from './types';

// ── New default start theme: "Bullseye Anthem" ─────────────────────────
// Heroic major-key anthem with a strong melodic hook, driving rock beat,
// and a triumphant brass-style fanfare. Properly loops in 8 bars.
export const bullseyeAnthem: Track = {
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
export const dartWarsTheme: Track = {
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
