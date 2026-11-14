/**
 * Procedural Web Audio API synthesizer for Cotonou Syndicat.
 * Generates gunfire, vehicle engine hum, police siren wails,
 * cash pickup chimes, impacts, and mission fanfares with zero external files.
 */

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private sirenPhase = 0;
  private anthemAudio: HTMLAudioElement | null = null;

  /**
   * Lazily initializes the AudioContext on first user interaction.
   */
  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.45;
      this.masterGain.connect(this.ctx.destination);

      // Pre-build a short white-noise buffer for gunshots and explosions
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.6);
      this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Continuous engine oscillator (audible only while driving)
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 240;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();

      // Continuous police siren oscillator (audible when wanted > 0)
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 620;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.masterGain);
      this.sirenOsc.start();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.03);
    }
    if (this.anthemAudio) {
      this.anthemAudio.muted = muted;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Updates continuous engine pitch and police siren modulation each frame.
   */
  public updateLoops(dt: number, active: boolean, speedRatio: number, isMoto: boolean, wantedLevel: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.sirenOsc || !this.sirenGain) return;
    const now = this.ctx.currentTime;

    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.sirenGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }

    // Engine hum proportional to speed
    if (speedRatio >= 0) {
      const baseFreq = isMoto ? 72 : 48;
      const maxBoost = isMoto ? 125 : 85;
      this.engineOsc.frequency.setTargetAtTime(baseFreq + speedRatio * maxBoost, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.06 + speedRatio * 0.07, now, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.05);
    }

    // Police siren two-tone modulation
    if (wantedLevel > 0) {
      this.sirenPhase += dt * (2.6 + wantedLevel * 0.4);
      const tone = Math.sin(this.sirenPhase * Math.PI) > 0 ? 780 : 540;
      this.sirenOsc.frequency.setTargetAtTime(tone, now, 0.04);
      this.sirenGain.gain.setTargetAtTime(0.035 * Math.min(wantedLevel, 2), now, 0.08);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  /**
   * Punchy firearm shot combining filtered noise and sub-bass kick.
   */
  public playShoot(isEnemy = false): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isEnemy ? 900 : 1250, now);
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isEnemy ? 0.2 : 0.36, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.15);

    // Low punch oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isEnemy ? 130 : 175, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(isEnemy ? 0.18 : 0.32, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  /**
   * Metallic or flesh impact thud.
   */
  public playHit(heavy = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = heavy ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(heavy ? 110 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + (heavy ? 0.18 : 0.08));

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(heavy ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.2 : 0.09));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (heavy ? 0.21 : 0.1));
  }

  /**
   * Heavy vehicle or crate explosion.
   */
  public playExplosion(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.55);
  }

  /**
   * Bright dual-note chime for cash, ammo, or health pickup.
   */
  public playPickup(kind: 'cash' | 'health' | 'mission'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes =
      kind === 'mission'
        ? [523.25, 659.25, 783.99, 1046.5]
        : kind === 'health'
          ? [440, 587.33]
          : [659.25, 987.77];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /**
   * Vehicle door / ignition click.
   */
  public playVehicleToggle(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(240, now + 0.04);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private anthemDesired = false;

  /**
   * Plays the official audio recording of the National Anthem of Benin ("L'Aube Nouvelle")
   * obtained from Wikimedia Commons / Wikipedia (U.S. Navy Band official performance).
   * Returns true if playback started immediately, false if blocked by browser autoplay policy.
   */
  public async playAnthem(onEnded?: () => void): Promise<boolean> {
    this.anthemDesired = true;
    if (!this.anthemAudio) {
      this.anthemAudio = new Audio();
      const canPlayMp3 = Boolean(this.anthemAudio.canPlayType('audio/mpeg'));
      this.anthemAudio.src = canPlayMp3 ? '/aube_nouvelle.mp3' : '/aube_nouvelle.ogg';
      this.anthemAudio.preload = 'auto';
    }

    this.anthemAudio.onended = () => {
      this.anthemDesired = false;
      onEnded?.();
    };

    this.anthemAudio.volume = this.muted ? 0 : 0.65;
    this.anthemAudio.muted = this.muted;
    this.anthemAudio.currentTime = 0;

    try {
      await this.anthemAudio.play();
      if (!this.anthemDesired && this.anthemAudio) {
        this.anthemAudio.pause();
        this.anthemAudio.currentTime = 0;
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  public stopAnthem(): void {
    this.anthemDesired = false;
    if (this.anthemAudio) {
      this.anthemAudio.pause();
      this.anthemAudio.currentTime = 0;
    }
  }

  public isAnthemPlaying(): boolean {
    return Boolean(this.anthemAudio && !this.anthemAudio.paused);
  }

  public dispose(): void {
    this.stopAnthem();
    if (this.anthemAudio) {
      this.anthemAudio.pause();
      this.anthemAudio.src = '';
      this.anthemAudio = null;
    }
    try {
      this.engineOsc?.stop();
      this.sirenOsc?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup errors if AudioContext was never unlocked
    }
    this.ctx = null;
  }
}

