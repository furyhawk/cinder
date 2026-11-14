export interface Particle {
  x: number;
  y: number;
  life: number;
}

export class ParticlePool {
  private readonly budget: number;
  private readonly particles: Particle[] = [];

  constructor(budget = 1800) {
    this.budget = budget;
  }

  add(particle: Particle): void {
    this.particles.push(particle);
    if (this.particles.length > this.budget) {
      const overflow = this.particles.length - this.budget;
      this.particles.splice(0, overflow);
    }
  }

  step(dtMs: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      this.particles[index].life -= dtMs;
      if (this.particles[index].life <= 0) {
        this.particles.splice(index, 1);
      }
    }
  }

  count(): number {
    return this.particles.length;
  }
}
