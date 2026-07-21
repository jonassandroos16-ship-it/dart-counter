import type { Settings } from '../types';
import { type Ctx, type Track } from './types';
import { MUSIC_TRACKS, tracksFor } from './registry';

// Master output volume curve. Music used to peak at ~0.18 master gain, which
// is barely audible on a phone at max volume. We now push the master to ~0.9
// and route through a DynamicsCompressor limiter so layered notes don't clip.
function masterTarget(context: string): number {
  if (context === 'match') return 0.55;
  if (context === 'coop') return 0.5;
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
      : context === 'coop'
        ? settings.musicCoopTrack
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
    const begin = () => {
      if (this.track !== trackId) return;
      const now = ctx.currentTime;
      master.gain.setValueAtTime(0.0001, now);
      const target = masterTarget(def.context) * musicVol;
      master.gain.linearRampToValueAtTime(target, now + 1.0);
      this.playTrack(def, ctx);
    };
    if (ctx.state === 'running') {
      begin();
    } else {
      const tryBegin = (attempt: number) => {
        if (this.track !== trackId) return;
        if (ctx.state === 'running') { begin(); return; }
        if (attempt >= 20) { begin(); return; }
        this.timers.push(setTimeout(() => tryBegin(attempt + 1), 100));
      };
      tryBegin(0);
    }
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
