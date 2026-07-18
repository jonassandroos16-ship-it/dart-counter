import type { Settings } from './types';

type Ctx = AudioContext | null;

interface Track {
  id: string; name: string; context: 'setup' | 'match';
  play: (engine: MusicEngine, ctx: AudioContext) => void;
}

const MUSIC_TRACKS: Track[] = [
  { id: 'setup_calm', name: 'Calm Pad', context: 'setup', play(engine, ctx) {
    const chords = [[261.6,329.6,392.0],[293.7,349.2,440.0],[220.0,277.2,329.6],[246.9,311.1,392.0]];
    const beat = 1.9;
    const loop = () => {
      if (engine.track !== 'setup_calm') return;
      const t0 = ctx.currentTime + 0.05;
      const chord = chords[Math.floor(Math.random()*chords.length)];
      chord.forEach((f,i) => engine.tone(ctx, f, t0 + i*0.05, beat*1.8, 'sine', 0.05));
      engine.tone(ctx, chord[Math.floor(Math.random()*chord.length)]*2, t0 + beat*0.9, beat*0.9, 'triangle', 0.035);
      engine.timers.push(setTimeout(loop, beat*2000));
    }; loop();
  }},
  { id: 'setup_marimba', name: 'Marimba Drift', context: 'setup', play(engine, ctx) {
    const scale = [261.6,293.7,329.6,392.0,440.0,523.3]; const step = 0.55; let i = 0;
    const loop = () => {
      if (engine.track !== 'setup_marimba') return;
      const t0 = ctx.currentTime + 0.03;
      const note = scale[Math.floor(Math.random()*scale.length)];
      engine.tone(ctx, note, t0, step*1.6, 'triangle', 0.06);
      if (i % 4 === 0) engine.tone(ctx, note/2, t0, step*3, 'sine', 0.03);
      i++; engine.timers.push(setTimeout(loop, step*1000));
    }; loop();
  }},
  { id: 'setup_lofi', name: 'Lo-fi Chill', context: 'setup', play(engine, ctx) {
    const prog = [[220.0,277.2,329.6],[196.0,246.9,293.7],[174.6,220.0,261.6],[196.0,246.9,329.6]]; const beat = 2.4; let i = 0;
    const loop = () => {
      if (engine.track !== 'setup_lofi') return;
      const t0 = ctx.currentTime + 0.05; const chord = prog[i % prog.length];
      chord.forEach((f) => engine.tone(ctx, f, t0, beat*1.9, 'sine', 0.045));
      engine.tone(ctx, chord[0]/2, t0, beat*0.9, 'triangle', 0.05);
      engine.tone(ctx, chord[0]/2, t0 + beat, beat*0.9, 'triangle', 0.04);
      i++; engine.timers.push(setTimeout(loop, beat*2000));
    }; loop();
  }},
  { id: 'match_drive', name: 'Drive', context: 'match', play(engine, ctx) {
    const bass = [82.4,82.4,110.0,98.0]; const lead = [[659.3,784.0],[659.3,880.0],[587.3,698.5],[523.3,659.3]]; const step = 0.42; let i = 0;
    const loop = () => {
      if (engine.track !== 'match_drive') return;
      const t0 = ctx.currentTime + 0.03;
      engine.tone(ctx, bass[i % bass.length], t0, step*0.9, 'sawtooth', 0.09);
      const pair = lead[i % lead.length];
      engine.tone(ctx, pair[0], t0, step*0.5, 'square', 0.045);
      if (i % 2 === 0) engine.tone(ctx, pair[1], t0 + step*0.5, step*0.45, 'square', 0.035);
      i++; engine.timers.push(setTimeout(loop, step*1000));
    }; loop();
  }},
  { id: 'match_arena', name: 'Arena', context: 'match', play(engine, ctx) {
    const stabs = [[392.0,493.9,587.3],[349.2,440.0,523.3],[440.0,554.4,659.3],[392.0,493.9,659.3]]; const step = 0.5; let i = 0;
    const loop = () => {
      if (engine.track !== 'match_arena') return;
      const t0 = ctx.currentTime + 0.03;
      engine.tone(ctx, 60, t0, 0.16, 'sine', 0.14);
      if (i % 2 === 1) stabs[Math.floor(i/2) % stabs.length].forEach((f) => engine.tone(ctx, f, t0+0.02, step*0.55, 'square', 0.03));
      i++; engine.timers.push(setTimeout(loop, step*1000));
    }; loop();
  }},
  { id: 'match_pulse', name: 'Pulse Runner', context: 'match', play(engine, ctx) {
    const chordA = [220.0,277.2,329.6,440.0]; const chordB = [196.0,246.9,329.6,392.0]; const step = 0.16; let i = 0;
    const loop = () => {
      if (engine.track !== 'match_pulse') return;
      const t0 = ctx.currentTime + 0.02;
      const chord = Math.floor(i/8) % 2 === 0 ? chordA : chordB;
      const note = chord[i % chord.length];
      engine.tone(ctx, note, t0, step*0.9, 'sawtooth', 0.05);
      if (i % 8 === 0) engine.tone(ctx, note/4, t0, step*7, 'triangle', 0.07);
      i++; engine.timers.push(setTimeout(loop, step*1000));
    }; loop();
  }},
];

export function tracksFor(context: string): Track[] { return MUSIC_TRACKS.filter(t => t.context === context); }

export class MusicEngine {
  ctx: Ctx = null; master: GainNode | null = null; nodes: OscillatorNode[] = []; timers: ReturnType<typeof setTimeout>[] = []; track: string | null = null; unlocked = false;

  ensure(): Ctx {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { this.ctx = null; } }
    return this.ctx;
  }

  stop() {
    this.timers.forEach(t => clearTimeout(t)); this.timers = [];
    const ctx = this.ctx;
    if (ctx && this.master) {
      const now = ctx.currentTime;
      try { this.master.gain.cancelScheduledValues(now); this.master.gain.setValueAtTime(this.master.gain.value, now); this.master.gain.linearRampToValueAtTime(0.0001, now + 0.4); } catch {}
    }
    const nodesToKill = this.nodes;
    setTimeout(() => { nodesToKill.forEach(n => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} }); }, 450);
    this.nodes = []; this.track = null;
  }

  trackFor(context: string, settings: Settings): Track | undefined {
    const chosenId = context === 'match' ? settings.musicMatchTrack : settings.musicSetupTrack;
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
    const ctx = this.ensure(); if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume(); if (ctx.state === 'suspended') { this.track = null; return; } }
    this.track = trackId;
    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(def.context === 'match' ? 0.16 : 0.10, ctx.currentTime + 1.2);
    this.master.connect(ctx.destination);
    def.play(this, ctx);
  }

  tone(ctx: AudioContext, freq: number, start: number, dur: number, wave: OscillatorType, gain: number) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = freq; o.connect(g); g.connect(this.master!);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start); o.stop(start + dur + 0.05);
    this.nodes.push(o);
  }
}
