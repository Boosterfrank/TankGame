// Music playback with an AnalyserNode feeding the visualizer. Starts after the first user gesture.
import { MUSIC_TRACKS } from './config.js';

export class MusicPlayer {
  constructor(audio) {
    this.audio = audio;          // GameAudio (owns the AudioContext)
    this.el = null; this.source = null; this.analyser = null; this.gain = null;
    this.data = new Uint8Array(128);
    this.bass = 0; this.mid = 0; this.high = 0; this.level = 0;
    this.track = 0;
    this.volume = 0.6; this.enabled = true;
    this.ducked = false;
    this.started = false;
    this.failed = false;
  }

  // Playback (and therefore the analyser) keeps running while muted; mute only silences the gain.
  get active() { return !!this.el && this.started && !this.failed && !this.el.paused; }
  get title() { return MUSIC_TRACKS[this.track]?.title || 'Music'; }

  init() {
    if (this.el || this.failed) return;
    this.audio.init();
    const ctx = this.audio.ctx;
    const track = MUSIC_TRACKS[this.track];
    if (!ctx || !track) { this.failed = true; return; }
    const el = new Audio();
    el.loop = true; el.preload = 'auto';
    const probe = document.createElement('audio');
    const src = track.sources.find((s) => {
      const ext = s.split('.').pop();
      const type = { ogg: 'audio/ogg; codecs="vorbis"', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4' }[ext] || '';
      return !type || probe.canPlayType(type);
    }) || track.sources[0];
    el.src = src;
    el.addEventListener('error', () => { this.failed = true; });
    try {
      this.source = ctx.createMediaElementSource(el);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      this.source.connect(this.analyser);
      this.analyser.connect(this.gain);
      this.gain.connect(ctx.destination);
    } catch (e) { this.failed = true; return; }
    this.el = el;
  }

  play() {
    this.init();
    if (!this.el || this.failed) return;
    const p = this.el.play();
    if (p && p.catch) p.catch(() => { /* autoplay blocked or no output device */ });
    this.started = true;
    this.fadeTo(this.targetVolume(), 1.5);
  }

  targetVolume() { return this.enabled ? this.volume * (this.ducked ? 0.28 : 1) : 0; }

  fadeTo(v, secs = 1) {
    if (!this.gain) return;
    const t = this.audio.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(Math.max(0.0001, v), t, Math.max(0.05, secs / 3));
  }

  duck(on) { this.ducked = on; this.fadeTo(this.targetVolume(), on ? 1.2 : 2); }
  setVolume(v) { this.volume = v; this.fadeTo(this.targetVolume(), 0.3); }
  setEnabled(on) {
    this.enabled = on;
    if (on) { if (this.started) { this.el?.play?.().catch?.(() => {}); } else this.play(); this.fadeTo(this.targetVolume(), 0.6); }
    else this.fadeTo(0, 0.4);
  }

  update() {
    if (!this.analyser || !this.active) { this.bass += (0 - this.bass) * 0.1; this.level *= 0.9; return; }
    this.analyser.getByteFrequencyData(this.data);
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += this.data[i]; return s / ((b - a) * 255); };
    const bass = avg(1, 6), mid = avg(6, 30), high = avg(30, 80);
    this.bass += (bass - this.bass) * 0.35;
    this.mid += (mid - this.mid) * 0.3;
    this.high += (high - this.high) * 0.3;
    this.level = (this.bass * 0.5 + this.mid * 0.35 + this.high * 0.15);
  }
}
