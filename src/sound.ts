import type { PlayerSoundId, Settings } from './types';

type Ctx = AudioContext | null;

// ── Engine helpers ──────────────────────────────────────────────────
// All SFX and player themes are synthesised live with WebAudio. The engine
// uses a shared reverb-style feedback delay for spatial depth, multi-voice
// detuning for richer timbres, and consistent ADSR envelopes so every cue
// has weight and clarity without relying on samples.

function makeReverb(ctx: AudioContext): { input: AudioNode; output: AudioNode } | null {
  try {
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 2.2);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    conv.buffer = buf;
    const inGain = ctx.createGain();
    inGain.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const out = ctx.createGain();
    out.gain.value = 1;
    inGain.connect(conv);
    conv.connect(wet);
    wet.connect(out);
    inGain.connect(out);
    return { input: inGain, output: out };
  } catch {
    return null;
  }
}

function adsr(ctx: AudioContext, dest: AudioNode, start: number, dur: number, a: number, d: number, s: number, r: number, peak: number) {
  const g = ctx.createGain();
  const t0 = start;
  const sustain = Math.max(0.0001, peak * s);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.linearRampToValueAtTime(sustain, t0 + a + d);
  g.gain.setValueAtTime(sustain, t0 + Math.max(a + d, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  g.connect(dest);
  return g;
}

function osc(ctx: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, peak: number, detune = 0) {
  const o = ctx.createOscillator();
  const g = adsr(ctx, dest, start, dur, 0.005, 0.05, 0.55, Math.min(0.12, dur * 0.4), peak);
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (detune) o.detune.value = detune;
  o.connect(g);
  o.start(start);
  o.stop(start + dur + 0.05);
  return o;
}

// Rich tone: stacks multiple detuned oscillators for a fuller body.
function richTone(ctx: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
  osc(ctx, dest, freq, start, dur, type, peak, -6);
  osc(ctx, dest, freq, start, dur, type, peak * 0.7, 6);
  osc(ctx, dest, freq * 2, start, dur, 'sine', peak * 0.3, 0);
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
  const g = adsr(ctx, dest, start, dur, 0.002, 0.04, 0.3, Math.min(0.08, dur * 0.4), peak);
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

// Sub kick: short sine drop with a click transient on top.
function kick(ctx: AudioContext, dest: AudioNode, start: number, peak = 0.7, freq = 110, dur = 0.18) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, start);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * 0.35), start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(dest);
  o.start(start); o.stop(start + dur + 0.05);
  // Click
  noiseBurst(ctx, dest, start, 0.012, peak * 0.4, 4000, 2000);
}

function hat(ctx: AudioContext, dest: AudioNode, start: number, peak = 0.18, dur = 0.05) {
  noiseBurst(ctx, dest, start, dur, peak, 9000, 6000);
}

function chime(ctx: AudioContext, dest: AudioNode, freq: number, start: number, dur: number, peak: number) {
  richTone(ctx, dest, freq, start, dur, 'triangle', peak);
  osc(ctx, dest, freq * 3, start, dur * 0.6, 'sine', peak * 0.18);
}

// ── Hit sound packs ──────────────────────────────────────────────────
// Each pack renders a "hit" cue whose intensity scales with the damage
// value so harder hits sound heavier. Intensity 0 = miss, 1 = light,
// 2 = medium, 3 = heavy.
function playHitPack(ctx: AudioContext, reverb: AudioNode | null, pack: string, intensity: number, vol: number, startOffset: number) {
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  if (reverb) master.connect(reverb);
  const t = startOffset;
  const i = Math.max(0, Math.min(3, intensity));
  // Scale loudness and low-end with intensity.
  const peak = 0.35 + i * 0.18;
  const lowFreq = 60 + i * 25;
  const dur = 0.12 + i * 0.06;
  switch (pack) {
    case 'board': {
      // Cork-board fiber thud with a metallic ring.
      osc(ctx, master, 180 + i * 40, t, dur, 'sine', peak);
      osc(ctx, master, lowFreq, t, dur * 1.3, 'triangle', peak * 0.6);
      noiseBurst(ctx, master, t, 0.04 + i * 0.02, 0.3 + i * 0.1, 3000 + i * 800, 1500);
      chime(ctx, master, 1200 + i * 200, t + 0.005, 0.06, 0.06 + i * 0.02);
      break;
    }
    case 'punch': {
      // Heavy punch: sub drop + body hit.
      kick(ctx, master, t, peak, lowFreq, dur);
      osc(ctx, master, lowFreq * 0.7, t, dur * 1.5, 'sine', peak * 0.5);
      noiseBurst(ctx, master, t, 0.08 + i * 0.04, peak * 0.5, 600 + i * 200, 80);
      if (i >= 2) osc(ctx, master, 45, t + 0.02, 0.2, 'sawtooth', peak * 0.3);
      break;
    }
    case 'arcade': {
      // Retro arcade zaps with rising pitch at higher intensity.
      const baseFreq = 300 + i * 150;
      sweep(ctx, master, t, 0.1 + i * 0.04, baseFreq, baseFreq * 2.5, 'square', peak);
      osc(ctx, master, baseFreq * 2, t + 0.02, 0.06, 'square', peak * 0.4);
      if (i >= 2) chime(ctx, master, 1800, t + 0.05, 0.12, peak * 0.3);
      break;
    }
    case 'thud':
    default: {
      // Default layered thud (same family as dart_thud but intensity-scaled).
      osc(ctx, master, 200 + i * 50, t, dur, 'sine', peak);
      osc(ctx, master, 90 + i * 20, t, dur * 1.4, 'triangle', peak * 0.7);
      noiseBurst(ctx, master, t, 0.05 + i * 0.02, peak * 0.5, 3500, 1800);
      chime(ctx, master, 1320 + i * 100, t + 0.005, 0.08, 0.08 + i * 0.03);
      if (i >= 3) kick(ctx, master, t, peak * 0.5, 80, 0.18);
      break;
    }
  }
}

// ── Click sounds ─────────────────────────────────────────────────────
function playClickByName(ctx: AudioContext, reverb: AudioNode | null, id: string, vol: number, startOffset: number) {
  if (id === 'none') return;
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  if (reverb) master.connect(reverb);
  const t = startOffset;
  switch (id) {
    case 'tick':
      osc(ctx, master, 740, t, 0.04, 'sine', 0.3);
      osc(ctx, master, 1480, t + 0.003, 0.03, 'triangle', 0.12);
      break;
    case 'pop':
      sweep(ctx, master, t, 0.1, 420, 880, 'triangle', 0.4);
      chime(ctx, master, 880, t + 0.04, 0.12, 0.14);
      break;
    case 'tap':
      noiseBurst(ctx, master, t, 0.03, 0.25, 5000, 2000);
      osc(ctx, master, 320, t, 0.05, 'sine', 0.2);
      break;
  }
}

// ── SFX library ──────────────────────────────────────────────────────
function playSfxByName(ctx: AudioContext, reverb: AudioNode | null, name: string, vol: number, startOffset: number) {
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  if (reverb) master.connect(reverb);
  const t = startOffset;
  switch (name) {
    case 'click':
      osc(ctx, master, 740, t, 0.05, 'sine', 0.35);
      osc(ctx, master, 1480, t + 0.004, 0.04, 'triangle', 0.18);
      hat(ctx, master, t, 0.08, 0.03);
      break;
    case 'pop':
      sweep(ctx, master, t, 0.14, 420, 920, 'triangle', 0.5);
      chime(ctx, master, 880, t + 0.06, 0.18, 0.18);
      break;
    case 'whoosh':
      noiseBurst(ctx, master, t, 0.32, 0.55, 1400, 250);
      sweep(ctx, master, t, 0.32, 320, 90, 'sine', 0.18);
      break;
    case 'impact':
      kick(ctx, master, t, 0.8, 140, 0.22);
      osc(ctx, master, 70, t, 0.22, 'triangle', 0.35);
      noiseBurst(ctx, master, t, 0.18, 0.45, 900, 120);
      chime(ctx, master, 220, t + 0.02, 0.25, 0.12);
      break;
    case 'dart':
    case 'dart_thud': {
      // Layered thud: low body + board-fiber transient + tiny metallic ring.
      osc(ctx, master, 200, t, 0.12, 'sine', 0.5);
      osc(ctx, master, 90, t, 0.16, 'triangle', 0.35);
      noiseBurst(ctx, master, t, 0.05, 0.35, 3500, 1800);
      chime(ctx, master, 1320, t + 0.005, 0.08, 0.08);
      break;
    }
    case 'win': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => chime(ctx, master, f, t + i * 0.11, 0.5, 0.4));
      osc(ctx, master, 2093, t + 0.45, 0.6, 'sine', 0.18);
      break;
    }
    case 'bust':
      sweep(ctx, master, t, 0.55, 240, 55, 'sawtooth', 0.55);
      noiseBurst(ctx, master, t, 0.32, 0.32, 700, 120);
      kick(ctx, master, t + 0.05, 0.4, 90, 0.2);
      break;
    case 'milestone': {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => chime(ctx, master, f, t + i * 0.08, 0.32, 0.36));
      osc(ctx, master, 2637, t + 0.4, 0.5, 'sine', 0.15);
      break;
    }
    case 'levelup': {
      const notes = [392, 523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      notes.forEach((f, i) => chime(ctx, master, f, t + i * 0.1, 0.4, 0.36));
      osc(ctx, master, 2093, t + 0.7, 0.7, 'sine', 0.22);
      kick(ctx, master, t, 0.3, 120, 0.16);
      break;
    }
    case 'title': {
      const notes = [659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => chime(ctx, master, f, t + i * 0.1, 0.45, 0.38));
      osc(ctx, master, 1567.98, t + 0.4, 0.6, 'sine', 0.18);
      break;
    }
    case 'kill':
      sweep(ctx, master, t, 0.7, 200, 50, 'sine', 0.65);
      noiseBurst(ctx, master, t, 0.45, 0.4, 600, 100);
      kick(ctx, master, t + 0.05, 0.5, 80, 0.28);
      osc(ctx, master, 55, t + 0.2, 0.5, 'sawtooth', 0.25);
      break;
    case 'record': {
      const notes = [392, 523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => chime(ctx, master, f, t + i * 0.1, 0.32, 0.36));
      osc(ctx, master, 2637, t + 0.6, 0.7, 'sine', 0.2);
      break;
    }
    case 'vs': {
      // Duel horns: two brass-like swells that cross.
      sweep(ctx, master, t, 0.5, 220, 440, 'sawtooth', 0.4);
      sweep(ctx, master, t, 0.5, 330, 220, 'sawtooth', 0.3);
      kick(ctx, master, t + 0.45, 0.5, 120, 0.22);
      chime(ctx, master, 660, t + 0.45, 0.4, 0.25);
      break;
    }
    case 'showdown': {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((f, i) => chime(ctx, master, f, t + i * 0.09, 0.35, 0.32));
      kick(ctx, master, t, 0.5, 110, 0.2);
      kick(ctx, master, t + 0.36, 0.5, 110, 0.2);
      break;
    }
    case 'showdown_close': {
      sweep(ctx, master, t, 0.4, 880, 220, 'sawtooth', 0.35);
      chime(ctx, master, 440, t + 0.1, 0.4, 0.25);
      kick(ctx, master, t, 0.4, 100, 0.18);
      break;
    }
    case 'card_damage': {
      // Heavy blade/impact sound for damage cards
      kick(ctx, master, t, 0.7, 120, 0.2);
      osc(ctx, master, 180, t, 0.15, 'sawtooth', 0.4);
      noiseBurst(ctx, master, t, 0.08, 0.35, 2000, 300);
      chime(ctx, master, 880, t + 0.03, 0.1, 0.15);
      break;
    }
    case 'card_spell': {
      // Mystical shimmer for spell cards
      const notes = [659.25, 783.99, 987.77, 1174.66];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = adsr(ctx, master, t + i * 0.04, 0.3, 0.01, 0.08, 0.4, 0.2, 0.25);
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t + i * 0.04);
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = f * 0.015;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(g); o.start(t + i * 0.04); o.stop(t + i * 0.04 + 0.35);
        lfo.start(t + i * 0.04); lfo.stop(t + i * 0.04 + 0.35);
      });
      break;
    }
    case 'card_utility': {
      // Quick, light utility sound
      sweep(ctx, master, t, 0.12, 600, 1200, 'triangle', 0.35);
      chime(ctx, master, 1200, t + 0.04, 0.1, 0.12);
      hat(ctx, master, t, 0.1, 0.03);
      break;
    }
  }
}

// ── Player entrance themes ───────────────────────────────────────────
function playPlayerSoundByName(ctx: AudioContext, reverb: AudioNode | null, id: PlayerSoundId, vol: number, startOffset: number) {
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  if (reverb) master.connect(reverb);
  const t = startOffset;
  switch (id) {
    case 'hero': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        richTone(ctx, master, f, t + i * 0.12, 0.32, 'triangle', 0.42);
        osc(ctx, master, f * 2, t + i * 0.12, 0.2, 'sine', 0.14);
      });
      kick(ctx, master, t, 0.3, 110, 0.16);
      break;
    }
    case 'villain': {
      osc(ctx, master, 110, t, 0.55, 'sawtooth', 0.5);
      osc(ctx, master, 146.83, t, 0.55, 'sawtooth', 0.3);
      osc(ctx, master, 220, t, 0.55, 'square', 0.15);
      noiseBurst(ctx, master, t, 0.2, 0.25, 600, 80);
      osc(ctx, master, 110, t + 0.35, 0.32, 'sawtooth', 0.35);
      osc(ctx, master, 98, t + 0.35, 0.32, 'sine', 0.2);
      kick(ctx, master, t, 0.4, 80, 0.22);
      break;
    }
    case 'cyborg': {
      const blips = [880, 1320, 880, 1760];
      blips.forEach((f, i) => osc(ctx, master, f, t + i * 0.08, 0.08, 'square', 0.32));
      sweep(ctx, master, t + 0.32, 0.42, 420, 1200, 'sawtooth', 0.25);
      osc(ctx, master, 1760, t + 0.6, 0.1, 'square', 0.18);
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
        lg.gain.value = f * 0.012;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(g); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.7);
        lfo.start(t + i * 0.06); lfo.stop(t + i * 0.06 + 0.7);
        osc(ctx, master, f * 2, t + i * 0.06, 0.4, 'sine', 0.08);
      });
      break;
    }
    case 'beast': {
      osc(ctx, master, 80, t, 0.6, 'sawtooth', 0.55);
      osc(ctx, master, 55, t, 0.6, 'sawtooth', 0.35);
      sweep(ctx, master, t, 0.5, 220, 70, 'sawtooth', 0.35);
      noiseBurst(ctx, master, t, 0.4, 0.4, 800, 100);
      kick(ctx, master, t, 0.6, 70, 0.3);
      break;
    }
    case 'champion': {
      const notes = [392, 523.25, 659.25, 783.99];
      notes.forEach((f, i) => richTone(ctx, master, f, t + i * 0.1, 0.5, 'sawtooth', 0.36));
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
      g.gain.linearRampToValueAtTime(0.32, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      src.connect(lp); lp.connect(g); g.connect(master);
      src.start(t); src.stop(t + 1.4);
      kick(ctx, master, t, 0.4, 120, 0.2);
      break;
    }
    case 'none':
    default:
      break;
  }
}

interface EventDef { sfx?: string; combo?: boolean; }

const EVENT_MAP: Record<string, EventDef> = {
  dart: { sfx: 'dart_thud' },
  hit: { sfx: 'impact' },
  miss: { sfx: 'whoosh' },
  enter: { sfx: 'pop' },
  bust: { sfx: 'bust' },
  win: { sfx: 'win' },
  milestone: { sfx: 'milestone', combo: true },
  record: { sfx: 'record' },
  levelup: { sfx: 'levelup' },
  title: { sfx: 'title' },
  kill: { sfx: 'kill', combo: true },
  one_eighty: { sfx: 'milestone' },
  vs: { sfx: 'vs' },
  showdown: { sfx: 'showdown' },
  showdown_close: { sfx: 'showdown_close' },
};

const COMBO_WINDOW_MS = 4000;

class SoundEngine {
  ctx: Ctx = null;
  unlocked = false;
  private reverb: { input: AudioNode; output: AudioNode } | null = null;
  private lastComboTimes: Map<string, number> = new Map();
  private comboCounts: Map<string, number> = new Map();

  ensure(): Ctx {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.reverb = this.ctx ? makeReverb(this.ctx) : null;
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
    if (def.sfx) {
      // Combo events escalate the SFX intensity instead of swapping phrases.
      let vol = settings.sfxVolume ?? 0.9;
      if (def.combo) vol = Math.min(1, vol * (1 + 0.12 * this.advanceCombo(type)));
      playSfxByName(ctx, this.reverb?.input ?? null, def.sfx, vol, now);
    }
  }

  private advanceCombo(type: string): number {
    const now = Date.now();
    const last = this.lastComboTimes.get(type) || 0;
    const count = this.comboCounts.get(type) || 0;
    if (now - last > COMBO_WINDOW_MS) {
      this.lastComboTimes.set(type, now);
      this.comboCounts.set(type, 1);
      return 1;
    }
    const newCount = count + 1;
    this.comboCounts.set(type, newCount);
    this.lastComboTimes.set(type, now);
    return newCount;
  }

  playSfx(name: string, settings: Settings) {
    if (!settings.sound) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    playSfxByName(ctx, this.reverb?.input ?? null, name, settings.sfxVolume ?? 0.9, ctx.currentTime + 0.01);
  }

  playPlayerSound(id: PlayerSoundId, settings: Settings) {
    if (!settings.sound) return;
    if (!id || id === 'none') return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const vol = settings.sfxVolume ?? 0.9;
    const t = ctx.currentTime + 0.01;
    playPlayerSoundByName(ctx, this.reverb?.input ?? null, id, vol, t);
  }

  // Play a hit sound whose intensity scales with the damage value. Higher
  // damage = heavier/louder hit. Intensity buckets: 0 = miss, 1 = light,
  // 2 = medium, 3 = heavy. The selected sound pack comes from settings.
  playHit(damage: number, settings: Settings) {
    if (!settings.sound) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const intensity = damage <= 0 ? 0 : damage < 20 ? 1 : damage < 50 ? 2 : 3;
    const pack = settings.hitSoundPack ?? 'thud';
    const vol = settings.sfxVolume ?? 0.9;
    playHitPack(ctx, this.reverb?.input ?? null, pack, intensity, vol, ctx.currentTime + 0.01);
  }

  // Play a UI button click sound. Respects the clickSound setting and its
  // own volume slider.
  playClick(settings: Settings) {
    if (!settings.sound) return;
    const id = settings.clickSound ?? 'none';
    if (id === 'none') return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const vol = (settings.clickVolume ?? 0.6) * (settings.sfxVolume ?? 0.9);
    playClickByName(ctx, this.reverb?.input ?? null, id, vol, ctx.currentTime + 0.005);
  }
}

export const Sound = new SoundEngine();
