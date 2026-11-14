import { MusicEngine } from './music';

export type SoundEffect =
  | 'player_fire'
  | 'enemy_hit'
  | 'enemy_died'
  | 'player_hit'
  | 'surge'
  | 'pickup'
  | 'boss_phase'
  | 'boss_telegraph'
  | 'boss_attack'
  | 'boss_vulnerable'
  | 'boss_hit'
  | 'module_exposed'
  | 'module_destroyed'
  | 'arena_telegraph'
  | 'arena_mutated'
  | 'victory'
  | 'defeat'
  | 'upgrade'
  | 'card_offer'
  | 'menu_move'
  | 'menu_confirm'
  | 'restart';

const EFFECT_COOLDOWNS_MS: Partial<Record<SoundEffect, number>> = {
  player_fire: 70,
  enemy_hit: 45,
  boss_hit: 60,
  arena_telegraph: 250,
  boss_telegraph: 300,
  menu_move: 60,
};

interface ToneOptions {
  startFrequency: number;
  endFrequency?: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlayedAt = new Map<SoundEffect, number>();
  private mutedState = false;
  private music: MusicEngine | null = null;

  constructor(private readonly volume = 0.28) {}

  get muted(): boolean {
    return this.mutedState;
  }

  unlock(): boolean {
    if (this.mutedState) return false;

    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return false;

      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.music = new MusicEngine(this.context, this.master);
    }

    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return true;
  }

  toggleMuted(): boolean {
    this.mutedState = !this.mutedState;
    if (this.master && this.context) {
      this.master.gain.setValueAtTime(
        this.mutedState ? 0 : this.volume,
        this.context.currentTime,
      );
    }
    if (!this.mutedState) this.unlock();
    return this.mutedState;
  }

  updateMusic(tick: number, bossActive: boolean, paused: boolean): void {
    if (!this.context && !this.unlock()) return;
    this.music?.update(tick, bossActive, paused || this.mutedState);
  }

  playEffect(effect: SoundEffect): void {
    if (this.mutedState) return;
    if (!this.context && !this.unlock()) return;
    if (!this.context || !this.master) return;
    if (this.context.state === 'suspended') void this.context.resume();

    const nowMs = this.context.currentTime * 1000;
    const cooldown = EFFECT_COOLDOWNS_MS[effect] ?? 0;
    const last = this.lastPlayedAt.get(effect) ?? Number.NEGATIVE_INFINITY;
    if (nowMs - last < cooldown) return;
    this.lastPlayedAt.set(effect, nowMs);

    switch (effect) {
      case 'player_fire':
        this.tone({ startFrequency: 760, endFrequency: 430, duration: 0.07, gain: 0.045, type: 'square' });
        break;
      case 'enemy_hit':
        this.tone({ startFrequency: 210, endFrequency: 130, duration: 0.05, gain: 0.04, type: 'triangle' });
        break;
      case 'enemy_died':
        this.noise(0.16, 1100, 0.07);
        this.tone({ startFrequency: 190, endFrequency: 65, duration: 0.18, gain: 0.07, type: 'sawtooth' });
        break;
      case 'player_hit':
        this.tone({ startFrequency: 130, endFrequency: 55, duration: 0.24, gain: 0.13, type: 'sine' });
        this.noise(0.11, 420, 0.07);
        break;
      case 'surge':
        this.tone({ startFrequency: 180, endFrequency: 900, duration: 0.2, gain: 0.08, type: 'sawtooth' });
        this.noise(0.16, 1800, 0.05);
        break;
      case 'pickup':
        this.tone({ startFrequency: 880, endFrequency: 1320, duration: 0.08, gain: 0.045, type: 'sine' });
        break;
      case 'boss_phase':
        this.tone({ startFrequency: 110, endFrequency: 82, duration: 0.65, gain: 0.09, type: 'triangle' });
        this.tone({ startFrequency: 165, endFrequency: 123, duration: 0.55, gain: 0.045, type: 'sine' });
        break;
      case 'boss_telegraph':
        this.tone({ startFrequency: 440, endFrequency: 330, duration: 0.14, gain: 0.055, type: 'square' });
        break;
      case 'boss_attack':
        this.tone({ startFrequency: 240, endFrequency: 170, duration: 0.09, gain: 0.045, type: 'sawtooth' });
        break;
      case 'boss_vulnerable':
        this.tone({ startFrequency: 520, endFrequency: 680, duration: 0.16, gain: 0.05, type: 'triangle' });
        break;
      case 'boss_hit':
        this.tone({ startFrequency: 320, endFrequency: 210, duration: 0.06, gain: 0.035, type: 'square' });
        break;
      case 'module_exposed':
        this.tone({ startFrequency: 660, endFrequency: 990, duration: 0.2, gain: 0.06, type: 'sine' });
        break;
      case 'module_destroyed':
        this.noise(0.26, 900, 0.09);
        this.tone({ startFrequency: 150, endFrequency: 48, duration: 0.3, gain: 0.08, type: 'sawtooth' });
        break;
      case 'arena_telegraph':
        this.tone({ startFrequency: 340, endFrequency: 220, duration: 0.2, gain: 0.05, type: 'triangle' });
        break;
      case 'arena_mutated':
        this.noise(0.28, 700, 0.08);
        this.tone({ startFrequency: 100, endFrequency: 60, duration: 0.32, gain: 0.06, type: 'sine' });
        break;
      case 'victory':
        this.sequence([523, 659, 784, 1047], 0.14, 0.08);
        break;
      case 'defeat':
        this.sequence([220, 165, 110], 0.22, 0.09);
        break;
      case 'upgrade':
        this.sequence([523, 784], 0.12, 0.07);
        break;
      case 'card_offer':
        this.tone({ startFrequency: 988, endFrequency: 1175, duration: 0.09, gain: 0.04, type: 'sine' });
        break;
      case 'menu_move':
        this.tone({ startFrequency: 600, endFrequency: 700, duration: 0.04, gain: 0.025, type: 'square' });
        break;
      case 'menu_confirm':
        this.sequence([660, 880], 0.07, 0.05);
        break;
      case 'restart':
        this.sequence([392, 523], 0.08, 0.05);
        break;
    }
  }

  private tone(options: ToneOptions): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(Math.max(1, options.startFrequency), now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFrequency ?? options.startFrequency),
      now + options.duration,
    );
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(options.gain, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + options.duration + 0.02);
  }

  private noise(duration: number, cutoff: number, gain: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
    source.stop(now + duration);
  }

  private sequence(frequencies: number[], stepDuration: number, gain: number): void {
    if (!this.context) return;
    const start = this.context.currentTime;
    for (let index = 0; index < frequencies.length; index += 1) {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const at = start + index * stepDuration;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequencies[index], at);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(gain, at + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + stepDuration);
      oscillator.connect(envelope);
      envelope.connect(this.master!);
      oscillator.start(at);
      oscillator.stop(at + stepDuration + 0.02);
    }
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.context) throw new Error('Audio context is not initialized.');
    if (this.noiseBuffer) return this.noiseBuffer;

    const length = Math.floor(this.context.sampleRate * 0.5);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x12345678;
    for (let index = 0; index < length; index += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[index] = (seed / 0xffffffff) * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
