export class RiftAudio {
  private context: AudioContext | null = null;
  private lastScore = 0;
  private lastHealth = 3;
  private lastPhase = "";

  update(score: number, health: number, phase: string) {
    if (!this.context) return;

    if (score > this.lastScore) {
      this.tone(740, 0.08, "sine", 0.04);
      this.tone(1120, 0.05, "triangle", 0.025);
    }

    if (health < this.lastHealth) {
      this.tone(92, 0.2, "sawtooth", 0.06);
    }

    if (phase !== this.lastPhase && phase === "boss") {
      this.tone(64, 0.35, "sawtooth", 0.08);
      this.tone(138, 0.55, "square", 0.035);
    }

    this.lastScore = score;
    this.lastHealth = health;
    this.lastPhase = phase;
  }

  resume() {
    if (!this.context) {
      this.context = new AudioContext();
    }
    void this.context.resume();
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * 0.62), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
