// Procedural sound effects with WebAudio (no audio files needed).
export class GameAudio {
  constructor() {
    this.ctx = null; this.master = null;
    this.enabled = true; this.volume = 0.7;
    this.active = 0;
    this.engineGain = null; this.engineUntil = 0;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }
  setVolume(v) { this.volume = v; if (this.master && !this.muted) this.master.gain.value = v; }

  get t() { return this.ctx.currentTime; }

  _env(gain, attack, decay, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, this.t);
    g.gain.linearRampToValueAtTime(peak * gain, this.t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t + attack + decay);
    g.connect(this.master);
    return g;
  }

  _track(node, dur) {
    this.active++;
    setTimeout(() => { this.active--; try { node.disconnect(); } catch (e) { /* ignore */ } }, dur * 1000 + 100);
  }

  noise(dur, { type = 'lowpass', f0 = 1000, f1 = 100, gain = 0.5, attack = 0.005, q = 0.7 } = {}) {
    const ctx = this.ctx;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = type; filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, this.t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), this.t + dur);
    const env = this._env(gain, attack, dur - attack);
    src.connect(filt); filt.connect(env);
    src.start(); src.stop(this.t + dur + 0.05);
    this._track(env, dur);
  }

  tone(f0, f1, dur, { type = 'sine', gain = 0.3, attack = 0.005 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, this.t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), this.t + dur);
    const env = this._env(gain, attack, dur - attack);
    o.connect(env);
    o.start(); o.stop(this.t + dur + 0.05);
    this._track(env, dur);
  }

  play(name, opts = {}) {
    if (!this.enabled || !this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') return;
    if (this.active > 28) return;
    const p = opts.pitch || 1;
    switch (name) {
      case 'fire':
        this.noise(opts.big ? 0.3 : 0.16, { f0: 1800 * p, f1: 200, gain: opts.big ? 0.6 : 0.4 });
        this.tone(200 * p, 50, opts.big ? 0.3 : 0.18, { type: 'triangle', gain: 0.35 });
        break;
      case 'smallboom': this.noise(0.35, { f0: 900, f1: 90, gain: 0.45 }); this.tone(120, 40, 0.25, { type: 'sine', gain: 0.3 }); break;
      case 'boom': this.noise(0.7, { f0: 700, f1: 60, gain: 0.7 }); this.tone(90, 30, 0.5, { type: 'sine', gain: 0.45 }); break;
      case 'bigboom': this.noise(1.6, { f0: 600, f1: 35, gain: 0.95 }); this.tone(60, 22, 1.2, { type: 'sine', gain: 0.6 }); this.noise(0.25, { type: 'highpass', f0: 2000, f1: 4000, gain: 0.3 }); break;
      case 'hit': this.tone(520, 180, 0.09, { type: 'triangle', gain: 0.25 }); break;
      case 'death': this.noise(0.9, { f0: 800, f1: 50, gain: 0.7 }); this.tone(420, 40, 0.6, { type: 'sawtooth', gain: 0.25 }); break;
      case 'laser': this.tone(opts.big ? 700 : 1100, 180, opts.big ? 0.6 : 0.35, { type: 'sawtooth', gain: 0.25 }); this.noise(0.3, { type: 'highpass', f0: 1500, f1: 3000, gain: 0.2 }); break;
      case 'bounce': this.tone(320 * p, 140 * p, 0.07, { type: 'triangle', gain: 0.2 }); break;
      case 'dig': this.noise(0.25, { type: 'bandpass', f0: 500, f1: 300, gain: 0.3, q: 2 }); break;
      case 'click': this.tone(1300, 900, 0.03, { type: 'square', gain: 0.08 }); break;
      case 'lock': this.tone(620, 620, 0.07, { type: 'square', gain: 0.1 }); setTimeout(() => this.ctx && this.tone(930, 930, 0.1, { type: 'square', gain: 0.1 }), 80); break;
      case 'item': this.tone(400, 820, 0.18, { type: 'sine', gain: 0.25 }); break;
      case 'pickup': [0, 90, 180].forEach((d, i) => setTimeout(() => this.ctx && this.tone([520, 660, 880][i], [520, 660, 880][i], 0.12, { type: 'triangle', gain: 0.2 }), d)); break;
      case 'teleport': this.tone(200, 1400, 0.35, { type: 'sine', gain: 0.25 }); this.noise(0.3, { type: 'highpass', f0: 800, f1: 3000, gain: 0.15 }); break;
      case 'whistle': this.tone(1400, 500, 0.6, { type: 'sine', gain: 0.08 }); break;
      case 'ufo': this.tone(380, 420, 1.0, { type: 'sine', gain: 0.15 }); this.tone(410, 370, 1.0, { type: 'triangle', gain: 0.08 }); break;
      case 'dirt': this.noise(0.35, { f0: 400, f1: 120, gain: 0.4 }); break;
      case 'tick': this.tone(900, 900, 0.03, { type: 'square', gain: 0.08 }); break;
      case 'win': [0, 120, 240, 420].forEach((d, i) => setTimeout(() => this.ctx && this.tone([523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.25, { type: 'triangle', gain: 0.22 }), d)); break;
      case 'lose': [0, 200, 400].forEach((d, i) => setTimeout(() => this.ctx && this.tone([392, 330, 262][i], [392, 330, 262][i] * 0.9, 0.3, { type: 'triangle', gain: 0.2 }), d)); break;
      case 'levelup': [0, 100, 200, 300, 500].forEach((d, i) => setTimeout(() => this.ctx && this.tone([440, 554, 659, 880, 1108][i], [440, 554, 659, 880, 1108][i], 0.2, { type: 'triangle', gain: 0.2 }), d)); break;
    }
  }

  // Engine rumble while the tank is driving.
  engine(on) {
    if (!this.enabled || !this.ctx || this.muted) return;
    if (!this.engineGain) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 28;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o.start(); o2.start();
      this.engineGain = g;
    }
    this.engineUntil = performance.now() + 120;
    this.engineGain.gain.setTargetAtTime(0.09, this.t, 0.05);
  }

  update() {
    if (this.engineGain && performance.now() > this.engineUntil) this.engineGain.gain.setTargetAtTime(0, this.t, 0.08);
  }
}
