import type { GPIOOutput } from "./gpio";
import type { PWMChannelOptions } from "./pwm";

/**
 * Software PWM using a fixed-rate tick approach.
 *
 * Instead of scheduling each transition, we run a fast timer and calculate
 * the correct output state based on elapsed time. This is more resilient
 * to timer jitter.
 */
export class SoftwarePWM {
  private readonly output: GPIOOutput;
  private _dutyCycle: number;
  private _frequencyHz: number;
  private _closed: boolean = false;

  private timer: ReturnType<typeof setInterval> | null = null;
  private cycleStartNs: number = 0;
  private lastState: boolean = false;

  /** Tick interval in milliseconds - faster = smoother but more CPU */
  private static readonly TICK_INTERVAL_MS = 1;

  constructor(
    output: GPIOOutput,
    options: PWMChannelOptions = { dutyCycle: 0.5, frequencyHz: 100 }
  ) {
    this.output = output;
    this._dutyCycle = options.dutyCycle ?? 0.5;
    this._frequencyHz = options.frequencyHz ?? 100;

    // Validate inputs
    if (this._dutyCycle < 0 || this._dutyCycle > 1) {
      throw new Error("Duty cycle must be between 0 and 1");
    }
    if (this._frequencyHz <= 0) {
      throw new Error("Frequency must be greater than 0");
    }

    // Auto-start the PWM
    this.cycleStartNs = Bun.nanoseconds();
    this.start();
  }

  /** Current duty cycle (0-1) */
  get dutyCycle(): number {
    return this._dutyCycle;
  }

  /** Current frequency in Hz */
  get frequencyHz(): number {
    return this._frequencyHz;
  }

  /** Current period in nanoseconds */
  get periodNs(): number {
    return Math.round(1_000_000_000 / this._frequencyHz);
  }

  /** Check if the PWM has been closed */
  get closed(): boolean {
    return this._closed;
  }

  private checkClosed(): void {
    if (this._closed) {
      throw new Error("SoftwarePWM has been closed");
    }
  }

  /**
   * Set the duty cycle as a ratio from 0 to 1
   * @param ratio Duty cycle where 0 = always off, 1 = always on
   */
  setDutyCycle(ratio: number): this {
    this.checkClosed();
    if (ratio < 0 || ratio > 1) {
      throw new Error("Duty cycle must be between 0 and 1");
    }

    this._dutyCycle = ratio;
    return this;
  }

  /**
   * Set the frequency in Hz
   * @param frequencyHz Frequency in hertz
   */
  setFrequency(frequencyHz: number): this {
    this.checkClosed();
    if (frequencyHz <= 0) {
      throw new Error("Frequency must be greater than 0");
    }

    this._frequencyHz = frequencyHz;
    return this;
  }

  private start(): void {
    // Use setInterval for a fixed-rate tick
    this.timer = setInterval(() => this.tick(), SoftwarePWM.TICK_INTERVAL_MS);
    // Run first tick immediately
    this.tick();
  }

  private tick(): void {
    if (this._closed) return;

    // Handle edge cases: always off or always on
    if (this._dutyCycle <= 0) {
      if (this.lastState !== false) {
        this.output.write(false);
        this.lastState = false;
      }
      return;
    }
    if (this._dutyCycle >= 1) {
      if (this.lastState !== true) {
        this.output.write(true);
        this.lastState = true;
      }
      return;
    }

    const now = Bun.nanoseconds();
    const periodNs = 1_000_000_000 / this._frequencyHz;

    // Calculate position within the current cycle (0 to 1)
    let elapsedNs = now - this.cycleStartNs;

    // Wrap around to the next cycle if we've completed one
    if (elapsedNs >= periodNs) {
      // How many complete cycles have passed?
      const completedCycles = Math.floor(elapsedNs / periodNs);
      this.cycleStartNs += completedCycles * periodNs;
      elapsedNs = now - this.cycleStartNs;
    }

    // Determine if we should be HIGH or LOW based on position in cycle
    const positionInCycle = elapsedNs / periodNs;
    const shouldBeHigh = positionInCycle < this._dutyCycle;

    // Only write if state changed (reduces GPIO overhead)
    if (shouldBeHigh !== this.lastState) {
      this.output.write(shouldBeHigh);
      this.lastState = shouldBeHigh;
    }
  }

  /**
   * Stop the PWM and release resources
   */
  close(): void {
    if (!this._closed) {
      this._closed = true;
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.output.write(false);
      this.lastState = false;
    }
  }
}
