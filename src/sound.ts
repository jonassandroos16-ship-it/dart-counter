import type { PlayerSoundId, Settings, VoicePackId } from './types';

type Ctx = AudioContext | null;

interface PackConfig {
  label: string;
  base: number;
  vibrato: number;
  vibDepth: number;
  formants: [number, number, number][];
  bright: number;
  speed: number;
}

const VOICE_PACKS: Record<VoicePackId, PackConfig> = {
  off: { label: 'None', base: 0, vibrato: 0, vibDepth: 0, formants: [[0, 0, 0]], bright: 0, speed: 1 },
  announcer: { label: 'Announcer (Clear)', base: 95, vibrato: 3.5, vibDepth: 0.025, formants: [[600, 1100, 2700]], bright: 0.35, speed: 1.6 },
  cyborg: { label: 'Cyborg (Robotic)', base: 130, vibrato: 0, vibDepth: 0, formants: [[300, 900, 2200]], bright: 0.4, speed: 1 },
  hype: { label: 'Hype (Energetic)', base: 160, vibrato: 5.5, vibDepth: 0.04, formants: [[260, 800, 2700]], bright: 0.35, speed: 1 },
  female: { label: 'Female (Clear)', base: 200, vibrato: 5.0, vibDepth: 0.035, formants: [[280, 1000, 2900]], bright: 0.3, speed: 1.1 },
};

export const VOICE_PACK_LIST: { id: VoicePackId; label: string }[] = [
  { id: 'off', label: 'None' },
  { id: 'announcer', label: 'Announcer (Clear)' },
  { id: 'cyborg', label: 'Cyborg (Robotic)' },
  { id: 'hype', label: 'Hype (Energetic)' },
  { id: 'female', label: 'Female (Clear)' },
];

function adsr(ctx: AudioContext, dest: AudioNode, start: number, dur: number, a: number, d: number, s: number, r: number, peak: number) {
  const g = ctx.createGain();
  const t0 = start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak * s), t0 + a + d);
  g.gain.setValueAtTime(Math.max(0.0001, peak * s), t0 + Math.max(a + d, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(dest);
  return g;
}

function osc(ctx: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
  const o = ctx.createOscillator();
  const g = adsr(ctx, dest, start, dur, 0.005, 0.04, 0.6, Math.min(0.1, dur * 0.4), peak);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  o.connect(g);
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

function noiseBurst(ctx: AudioContext, dest: AudioNode, start: number, dur: number, peak: number, lp: number, hp: number) {
  const n = Math.floor(dur * ctx.sampleRate);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lpNode = ctx.createBiquadFilter();
  lpNode.type = 'lowpass';
  lpNode.frequency.value = lp;
  const hpNode = ctx.createBiquadFilter();
  hpNode.type = 'highpass';
  hpNode.frequency.value = hp;
  const g = adsr(ctx, dest, start, dur, 0.002, 0.03, 0.3, Math.min(0.08, dur * 0.4), peak);
  src.connect(hpNode); hpNode.connect(lpNode); lpNode.connect(g);
  src.start(start);
  src.stop(start + dur + 0.05);
}

function sweep(ctx: AudioContext, dest: AudioNode, start: number, dur: number, f0: number, f1: number, type: OscillatorType, peak: number) {
  const o = ctx.createOscillator();
  const g = adsr(ctx, dest, start, dur, 0.004, 0.06, 0.4, Math.min(0.15, dur * 0.4), peak);
  o.type = type;
  o.frequency.setValueAtTime(f0, start);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
  o.connect(g);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function playSfxByName(ctx: AudioContext, name: string, vol: number, startOffset: number) {
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  const t = startOffset;
  switch (name) {
    case 'click':
      osc(ctx, master, 880, t, 0.06, 'sine', 0.5);
      osc(ctx, master, 1760, t + 0.005, 0.05, 'triangle', 0.2);
      break;
    case 'pop':
      sweep(ctx, master, t, 0.12, 440, 880, 'triangle', 0.55);
      break;
    case 'whoosh':
      noiseBurst(ctx, master, t, 0.28, 0.6, 1200, 200);
      break;
    case 'impact':
      osc(ctx, master, 120, t, 0.22, 'sine', 0.7);
      osc(ctx, master, 60, t, 0.22, 'triangle', 0.3);
      noiseBurst(ctx, master, t, 0.18, 0.5, 800, 100);
      break;
    case 'dart_thud':
      osc(ctx, master, 180, t, 0.14, 'sine', 0.6);
      noiseBurst(ctx, master, t, 0.06, 0.3, 2000, 1500);
      break;
    case 'win': {\n      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => osc(ctx, master, f, t + i * 0.12, 0.4, 'triangle', 0.4));
      break;
    }
    case 'bust':
      sweep(ctx, master, t, 0.5, 220, 60, 'sawtooth', 0.6);
      noiseBurst(ctx, master, t, 0.3, 0.3, 600, 100);
      break;
    case 'milestone': {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => osc(ctx, master, f, t + i * 0.08, 0.3, 'triangle', 0.4));
      break;
    }
    case 'levelup': {
      const notes = [392, 523, 659, 784, 1047, 1319, 1568];
      notes.forEach((f, i) => osc(ctx, master, f, t + i * 0.10, 0.35, 'triangle', 0.4));
      osc(ctx, master, 2093, t + 0.7, 0.6, 'sine', 0.2);
      break;
    }
    case 'title': {
      const notes = [659, 784, 1047, 1319];
      notes.forEach((f, i) => osc(ctx, master, f, t + i * 0.10, 0.4, 'sine', 0.4));
      break;
    }
    case 'kill':
      sweep(ctx, master, t, 0.6, 180, 50, 'sine', 0.7);
      noiseBurst(ctx, master, t, 0.4, 0.4, 500, 100);
      break;
    case 'record': {\n      const notes = [392, 523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => osc(ctx, master, f, t + i * 0.10, 0.3, 'triangle', 0.4));
      break;
    }
  }
}

function playPlayerSoundByName(ctx: AudioContext, id: PlayerSoundId, vol: number, startOffset: number) {
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  const t = startOffset;
  switch (id) {
    case 'hero': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        osc(ctx, master, f, t + i * 0.12, 0.3, 'triangle', 0.45);
        osc(ctx, master, f * 2, t + i * 0.12, 0.2, 'sine', 0.15);
      });
      break;
    }
    case 'villain': {
      osc(ctx, master, 110, t, 0.5, 'sawtooth', 0.5);
      osc(ctx, master, 146.83, t, 0.5, 'sawtooth', 0.3);
      noiseBurst(ctx, master, t, 0.18, 0.25, 600, 80);
      osc(ctx, master, 110, t + 0.35, 0.3, 'sawtooth', 0.35);
      osc(ctx, master, 98, t + 0.35, 0.3, 'sine', 0.2);
      break;
    }
    case 'cyborg': {
      const blips = [880, 1320, 880, 1760];
      blips.forEach((f, i) => osc(ctx, master, f, t + i * 0.08, 0.07, 'square', 0.35));
      sweep(ctx, master, t + 0.32, 0.4, 400, 1200, 'sawtooth', 0.25);
      break;
    }
    case 'mystic': {
      const notes = [783.99, 987.77, 1174.66, 1567.98];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = adsr(ctx, master, t + i * 0.06, 0.6, 0.04, 0.1, 0.5, 0.3, 0.3);
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t + i * 0.06);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 5;
        lg.gain.value = f * 0.01;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(g); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.7);
        lfo.start(t + i * 0.06); lfo.stop(t + i * 0.06 + 0.7);
      });
      break;
    }
    case 'beast': {
      osc(ctx, master, 80, t, 0.6, 'sawtooth', 0.55);
      sweep(ctx, master, t, 0.5, 220, 70, 'sawtooth', 0.35);
      noiseBurst(ctx, master, t, 0.4, 0.4, 800, 100);
      break;
    }
    case 'champion': {
      const notes = [392, 523.25, 659.25, 783.99];
      notes.forEach((f, i) => osc(ctx, master, f, t + i * 0.1, 0.5, 'sawtooth', 0.4));
      const n = Math.floor(1.2 * ctx.sampleRate);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (i / n);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 1200;
      lp.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 1.4);
      break;
    }
    case 'none':
    default:
      break;
  }
}

interface Phoneme { type: 'vowel' | 'consonant'; dur: number; pitch: number; formants: [number, number, number]; }

const V: Record<string, [number, number, number]> = {
  ah: [800, 1200, 2600], ay: [600, 1800, 2600], eh: [500, 1700, 2500],
  ih: [400, 1900, 2500], oh: [500, 900, 2400], uh: [600, 1200, 2400],
  oo: [400, 800, 2400], ee: [300, 2300, 2900],
};

const PHRASES: Record<string, Phoneme[]> = {
  double_kill: [
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.16, pitch: 1.0, formants: V.ah },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 0.95, formants: V.uh },
    { type: 'consonant', dur: 0.06, pitch: 1.05, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.18, pitch: 1.05, formants: V.ih },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.ih },
  ],
  triple_kill: [
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.12, pitch: 1.05, formants: V.ih },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.uh },
    { type: 'consonant', dur: 0.06, pitch: 1.05, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.18, pitch: 1.05, formants: V.ih },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.ih },
  ],
  eliminated: [
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.eh },
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.08, pitch: 1.0, formants: V.ih },
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.08, pitch: 1.0, formants: V.ih },
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.05, formants: V.ay },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.12, pitch: 0.95, formants: V.uh },
    { type: 'consonant', dur: 0.05, pitch: 0.95, formants: [0, 0, 0] },
  ],
  level_up: [
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.eh },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.uh },
    { type: 'vowel', dur: 0.12, pitch: 1.05, formants: V.uh },
    { type: 'consonant', dur: 0.05, pitch: 1.05, formants: [0, 0, 0] },
  ],
  milestone: [
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.ay },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.18, pitch: 1.05, formants: V.oh },
  ],
  title_unlocked: [
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.08, pitch: 1.0, formants: V.ay },
    { type: 'consonant', dur: 0.04, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.08, pitch: 1.0, formants: V.uh },
    { type: 'vowel', dur: 0.08, pitch: 1.0, formants: V.uh },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.05, formants: V.oh },
    { type: 'consonant', dur: 0.05, pitch: 1.05, formants: [0, 0, 0] },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
  ],
  one_eighty: [
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.12, pitch: 1.0, formants: V.uh },
    { type: 'vowel', dur: 0.10, pitch: 1.05, formants: V.ay },
    { type: 'consonant', dur: 0.05, pitch: 1.05, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.1, formants: V.ay },
    { type: 'vowel', dur: 0.16, pitch: 1.1, formants: V.ee },
  ],
  first_blood: [
    { type: 'consonant', dur: 0.06, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.uh },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'consonant', dur: 0.04, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'consonant', dur: 0.05, pitch: 1.05, formants: [0, 0, 0] },
    { type: 'consonant', dur: 0.05, pitch: 1.05, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.05, formants: V.uh },
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
  ],
  win: [
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.ih },
    { type: 'vowel', dur: 0.10, pitch: 1.0, formants: V.ih },
  ],
  bust: [
    { type: 'consonant', dur: 0.05, pitch: 1.0, formants: [0, 0, 0] },
    { type: 'vowel', dur: 0.12, pitch: 0.95, formants: V.uh },
    { type: 'consonant', dur: 0.05, pitch: 0.95, formants: [0, 0, 0] },
    { type: 'consonant', dur: 0.05, pitch: 0.9, formants: [0, 0, 0] },
  ],
};

function playVowel(ctx: AudioContext, dest: AudioNode, start: number, ph: Phoneme, pack: PackConfig) {
  const f0 = pack.base * ph.pitch;
  const dur = ph.dur;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = f0;
  const q = 10;
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = ph.formants[0]; f1.Q.value = q;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = ph.formants[1]; f2.Q.value = q;
  const f3 = ctx.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = ph.formants[2]; f3.Q.value = q;
  const g1 = ctx.createGain(); g1.gain.value = 1.2;
  const g2 = ctx.createGain(); g2.gain.value = 0.6;
  const g3 = ctx.createGain(); g3.gain.value = 0.3 + pack.bright * 0.3;
  const mix = ctx.createGain();
  mix.gain.value = 0.75;
  const env = adsr(ctx, dest, start, dur, 0.03, 0.05, 0.75, Math.max(0.06, dur * 0.4), 0.65);
  o.connect(f1); f1.connect(g1); g1.connect(mix);
  o.connect(f2); f2.connect(g2); g2.connect(mix);
  o.connect(f3); f3.connect(g3); g3.connect(mix);
  mix.connect(env);
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = f0 * 0.5;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.25;
  sub.connect(subGain); subGain.connect(env);
  if (pack.vibrato > 0) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = pack.vibrato;
    lfoGain.gain.value = f0 * pack.vibDepth;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    lfo.start(start); lfo.stop(start + dur + 0.05);
  }
  o.start(start);
  o.stop(start + dur + 0.05);
  sub.start(start);
  sub.stop(start + dur + 0.05);
}

function playConsonant(ctx: AudioContext, dest: AudioNode, start: number, ph: Phoneme, pack: PackConfig) {
  const dur = ph.dur;
  noiseBurst(ctx, dest, start, dur, 0.25, 3000, 1500);
  osc(ctx, dest, start, dur, pack.base * ph.pitch * 0.5, 'triangle', 0.15);
}

function playVoiceByName(ctx: AudioContext, phrase: string, packId: VoicePackId, vol: number, startOffset: number) {
  const pack = VOICE_PACKS[packId];
  if (!pack || pack.base === 0) return;
  const phs = PHRASES[phrase];
  if (!phs) return;
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  let t = startOffset;
  for (const ph of phs) {
    const scaled = { ...ph, dur: ph.dur * pack.speed };
    if (scaled.type === 'vowel') playVowel(ctx, master, t, scaled, pack);
    else playConsonant(ctx, master, t, scaled, pack);
    t += scaled.dur;
  }
}

interface EventDef { sfx?: string; voice?: string; combo?: boolean; }

const EVENT_MAP: Record<string, EventDef> = {
  dart: { sfx: 'dart_thud' },
  hit: { sfx: 'impact' },
  miss: { sfx: 'whoosh' },
  enter: { sfx: 'pop' },
  bust: { sfx: 'bust', voice: 'bust' },
  win: { sfx: 'win', voice: 'win' },
  milestone: { sfx: 'milestone', voice: 'milestone', combo: true },
  record: { sfx: 'record', voice: 'first_blood' },
  levelup: { sfx: 'levelup', voice: 'level_up' },
  title: { sfx: 'title', voice: 'title_unlocked' },
  kill: { sfx: 'kill', voice: 'eliminated', combo: true },
  one_eighty: { sfx: 'milestone', voice: 'one_eighty' },
};

const COMBO_WINDOW_MS = 4000;
const COMBO_PHRASES = ['double_kill', 'triple_kill'];

class SoundEngine {
  ctx: Ctx = null;
  unlocked = false;
  private lastComboTimes: Map<string, number> = new Map();
  private comboCounts: Map<string, number> = new Map();

  ensure(): Ctx {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    return this.ctx;
  }

  unlock() {
    this.unlocked = true;
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  async preload(_settings: Settings) { /* no-op */ }

  play(type: string, opts: { score?: number } = {}, settings: Settings) {
    if (!settings.sound) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (type === 'milestone' && opts.score != null && opts.score >= 180) {
      this.playEvent('one_eighty', settings);
      return;
    }
    this.playEvent(type, settings);
  }

  private playEvent(type: string, settings: Settings) {
    const def = EVENT_MAP[type];
    if (!def) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime + 0.02;
    if (def.sfx) playSfxByName(ctx, def.sfx, settings.sfxVolume ?? 0.9, now);
    if (def.voice && settings.voicePack && settings.voicePack !== 'off') {
      let phrase = def.voice;
      if (def.combo) phrase = this.advanceCombo(type);
      const delay = 0.08;
      setTimeout(() => {
        const c = this.ensure();
        if (!c) return;
        if (c.state === 'suspended') c.resume();
        playVoiceByName(c, phrase, settings.voicePack, settings.voiceVolume ?? 0.8, c.currentTime + 0.01);
      }, delay * 1000);
    }
  }

  private advanceCombo(type: string): string {
    const now = Date.now();
    const last = this.lastComboTimes.get(type) || 0;
    const count = this.comboCounts.get(type) || 0;
    const baseVoice = EVENT_MAP[type]?.voice || 'milestone';
    if (now - last > COMBO_WINDOW_MS) {
      this.lastComboTimes.set(type, now);
      this.comboCounts.set(type, 1);
      return baseVoice;
    }
    const newCount = count + 1;
    this.comboCounts.set(type, newCount);
    this.lastComboTimes.set(type, now);
    const idx = newCount - 2;
    if (idx >= 0 && idx < COMBO_PHRASES.length) return COMBO_PHRASES[idx];
    return baseVoice;
  }

  playVoice(phrase: string, settings: Settings) {
    if (!settings.sound) return;
    if (!settings.voicePack || settings.voicePack === 'off') return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    playVoiceByName(ctx, phrase, settings.voicePack, settings.voiceVolume ?? 0.8, ctx.currentTime + 0.01);
  }

  playSfx(name: string, settings: Settings) {
    if (!settings.sound) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    playSfxByName(ctx, name, settings.sfxVolume ?? 0.9, ctx.currentTime + 0.01);
  }

  playPlayerSound(id: PlayerSoundId, settings: Settings) {
    if (!settings.sound) return;
    if (!id || id === 'none') return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const vol = settings.sfxVolume ?? 0.9;
    const t = ctx.currentTime + 0.01;
    playPlayerSoundByName(ctx, id, vol, t);
  }
}

export const Sound = new SoundEngine();
