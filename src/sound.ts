import type { Settings } from './types';

type Ctx = AudioContext | null;

class SoundEngine {
  ctx: Ctx = null;
  unlocked = false;

  ensure(): Ctx {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { this.ctx = null; } }
    return this.ctx;
  }

  unlock() { this.unlocked = true; const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }

  play(type: string, opts: { score?: number } = {}, settings: Settings) {
    if (!settings.sound) return;
    const ctx = this.ensure(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const beep = (freq: number, start: number, dur: number, wave: OscillatorType = 'sine', gain = 0.13) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = wave; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.start(now + start); o.stop(now + start + dur + 0.03);
    };
    if (type === 'dart') {
      const score = opts.score ?? 0;
      const baseFreq = 200 + Math.min(score, 180) * 3;
      beep(baseFreq, 0, 0.07, 'triangle', 0.10);
      if (score >= 100) beep(baseFreq * 1.5, 0.04, 0.08, 'triangle', 0.08);
      return;
    }
    if (type === 'milestone') { [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.06, 0.15, 'triangle', 0.12)); return; }
    if (type === 'record') { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.07, 0.18, 'triangle', 0.14)); return; }
    if (type === 'levelup') { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => beep(f, i * 0.08, 0.20, 'triangle', 0.15)); return; }
    if (type === 'title') { [659, 784, 1047, 1319].forEach((f, i) => beep(f, i * 0.07, 0.18, 'sine', 0.13)); return; }
    switch (type) {
      case 'hit': beep(680, 0, 0.09, 'square', 0.11); beep(1020, 0.05, 0.10, 'square', 0.09); break;
      case 'miss': beep(150, 0, 0.14, 'sawtooth', 0.09); break;
      case 'enter': beep(460, 0, 0.07, 'sine', 0.10); break;
      case 'bust': beep(140, 0, 0.20, 'sawtooth', 0.13); beep(95, 0.09, 0.22, 'sawtooth', 0.11); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => beep(f, i * 0.09, 0.20, 'triangle', 0.13)); break;
    }
  }
}

export const Sound = new SoundEngine();
