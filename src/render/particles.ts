export interface Particle {
  x: number;
  y: number;
  life: number;
  vx?: number;
  vy?: number;
  size?: number;
  color?: string;
  gravity?: number;
  drag?: number;
  maxLife?: number;
}

export class ParticlePool {
  private readonly budget: number;
  private readonly particles: Particle[] = [];

  constructor(budget = 1800) {
    this.budget = budget;
  }

  add(particle: Particle): void {
    particle.maxLife ??= particle.life;
    this.particles.push(particle);
    if (this.particles.length > this.budget) {
      const overflow = this.particles.length - this.budget;
      this.particles.splice(0, overflow);
    }
  }

  step(dtMs: number): void {
    const dtSeconds = Math.max(0, dtMs) / 1000;
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dtMs;
      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }

      const drag = Math.max(0, 1 - (particle.drag ?? 2) * dtSeconds);
      particle.vx = (particle.vx ?? 0) * drag;
      particle.vy = (particle.vy ?? 0) * drag + (particle.gravity ?? 0) * dtSeconds;
      particle.x += particle.vx * dtSeconds;
      particle.y += particle.vy * dtSeconds;
    }
  }

  getParticles(): readonly Particle[] {
    return this.particles;
  }

  clear(): void {
    this.particles.length = 0;
  }

  count(): number {
    return this.particles.length;
  }
}
