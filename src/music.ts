import type { Settings } from './types';

type Ctx = AudioContext | null;

interface Track {
  id: string; name: string; context: 'setup' | 'match';
  play: (engine: MusicEngine, ctx: AudioContext) => void;
}

const TRACKS: Track[] = [
  {
    id: 'calm', name: 'Calm', context: 'setup',
    play: (engine, ctx) => {
      const notes = [220, 277.18, 329.63, 440];
      let i = 0;
      const tick = () => {
        if (engine.track !== 'calm' || !engine.playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = notes[i % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
        osc.connect(gain); gain.connect(engine.masterGain!);
        osc.start(); osc.stop(ctx.currentTime + 0.8);
        i++;
        engine.timers.push(setTimeout(tick, 700));
      };
      tick();
    },
  },
  {
    id: 'focus', name: 'Focus', context: 'setup',
    play: (engine, ctx) => {
      const notes = [196, 246.94, 293.66, 392, 293.66, 246.94];
      let i = 0;
      const tick = () => {
        if (engine.track !== 'focus' || !engine.playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = notes[i % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.04);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(engine.masterGain!);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
        i++;
        engine.timers.push(setTimeout(tick, 450));
      };
      tick();
    },
  },
  {
    id: 'punchy', name: 'Punchy', context: 'setup',
    play: (engine, ctx) => {
      const notes = [261.63, 311.13, 392, 523.25];
      let i = 0;
      const tick = () => {
        if (engine.track !== 'punchy' || !engine.playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = notes[i % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.connect(gain); gain.connect(engine.masterGain!);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        i++;
        engine.timers.push(setTimeout(tick, 350));
      };
      tick();
    },
  },
  {
    id: 'match1', name: 'Match 1', context: 'match',
    play: (engine, ctx) => {
      const notes = [330, 392, 494, 392, 330, 262];
      let i = 0;
      const tick = () => {
        if (engine.track !== 'match1' || !engine.playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = notes[i % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.03);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain); gain.connect(engine.masterGain!);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
        i++;
        engine.timers.push(setTimeout(tick, 380));
      };
      tick();
    },
  },
  {
    id: 'match2', name: 'Match 2', context: 'match',
    play: (engine, ctx) => {
      const notes = [293.66, 349.23, 440, 587.33, 440, 349.23];
      let i = 0;
      const tick = () => {
        if (engine.track !== 'match2' || !engine.playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = notes[i % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.03);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
        osc.connect(gain); gain.connect(engine.masterGain!);
        osc.start(); osc.stop(ctx.currentTime + 0.45);
        i++;
        engine.timers.push(setTimeout(tick, 400));
      };
      tick();
    },
  },
  {
    id: 'match3', name: 'Match 3', context: 'match',
    play: (engine, ctx) => {
      const notes = [349.23, 415.3, 523.25, 698.46, 523.25, 415.3];
      let i = 0;
      const tick = () => {
        if (engine.track !== 'match3' || !engine.playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = notes[i % notes.length];
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.04);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(engine.masterGain!);
        osc.start(); osc.stop(ctx.currentTime + 0.5);
        i++;
        engine.timers.push(setTimeout(tick, 420));
      };
      tick();
    },
  },
];

export class MusicEngine {
  ctx: Ctx = null;
  masterGain: GainNode | null = null;
  playing = false;
  track: string | null = null;
  timers: ReturnType<typeof setTimeout>[] = [];
  unlocked = false;
  currentContext: 'setup' | 'match' = 'setup';
  currentSettings: Settings | null = null;

  ensureCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.ctx.destination);
      } catch { this.ctx = null; }
    }
    return this.ctx;
  }

  startContext(context: 'setup' | 'match', settings: Settings) {
    this.currentContext = context;
    this.currentSettings = settings;
    if (!settings.music) { this.stop(); return; }
    const trackId = context === 'match' ? settings.musicMatchTrack : settings.musicSetupTrack;
    if (this.track === trackId && this.playing) return;
    this.play(trackId);
  }

  play(trackId: string) {
    if (!this.unlocked) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    this.stop();
    this.track = trackId;
    this.playing = true;
    const track = TRACKS.find(t => t.id === trackId);
    if (track) track.play(this, ctx);
  }

  stop() {
    this.playing = false;
    this.track = null;
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}
