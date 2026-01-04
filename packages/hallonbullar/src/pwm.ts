/**
 * Hardware PWM support for Bun on Linux
 *
 * Provides easy-to-use PWM controller and PWMChannel classes using the Linux sysfs PWM interface.
 *
 * @example
 * ```typescript
 * const pwm = new PWM("/sys/class/pwm/pwmchip0");
 *
 * const motor = pwm.channel(0, {
 *   frequencyHz: 1000,
 *   dutyCycle: 0.5,
 * });
 *
 * motor.setDutyCycle(0.75);
 * motor.setFrequency(2000);
 *
 * pwm.close();
 * ```
 */

import { existsSync, writeFileSync as fsWriteFileSync } from "fs";
import { accessSync, constants } from "fs";

// =============================================================================
// Types
// =============================================================================

/** Options for creating a PWM channel */
export interface PWMChannelOptions {
  /** Initial frequency in Hz */
  frequencyHz?: number;
  /** Initial duty cycle (0-1) */
  dutyCycle?: number;
}

/** Result of a permission check */
export interface PermissionCheckResult {
  /** Whether the export file is writable */
  canWrite: boolean;
  /** Whether the user is in the gpio group */
  inGpioGroup: boolean;
  /** Human-readable message about the status */
  message: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a file is writable
 */
function isWritable(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the current user is in the gpio group
 */
function isInGpioGroup(): boolean {
  try {
    // Try to get groups - process.getgroups may not be available in all environments
    let groups: number[] = [];
    if (typeof process.getgroups === "function") {
      groups = process.getgroups();
    }

    const gpioGid = Bun.spawnSync(["getent", "group", "gpio"], {
      stdout: "pipe",
    }).stdout?.toString();

    if (!gpioGid) return false;

    const match = gpioGid.match(/gpio:x:(\d+):/);
    if (!match || !match[1]) return false;
    const gpioGidNum = parseInt(match[1], 10);

    if (groups.length > 0) {
      return groups.includes(gpioGidNum);
    }

    // Fallback: check if we can read /sys/class/pwm (less reliable)
    try {
      accessSync("/sys/class/pwm", constants.R_OK);
      return true;
    } catch {
      return false;
    }
  } catch {
    // Fallback: check if we can read /sys/class/pwm (less reliable)
    try {
      accessSync("/sys/class/pwm", constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get a helpful error message for permission issues
 */
function getPermissionErrorMessage(chipPath: string): string {
  const exportPath = `${chipPath}/export`;
  const inGroup = isInGpioGroup();
  const scriptPath = "scripts/setup-pwm-permissions.sh";

  let message = `Permission denied: Cannot write to ${exportPath}\n\n`;

  if (!inGroup) {
    message += `You are not in the gpio group.\n`;
  }

  message += `To fix this, run the setup script:\n`;
  message += `  sudo bash ${scriptPath}\n\n`;
  message += `Or manually:\n`;
  message += `  1. Add yourself to gpio group: sudo usermod -aG gpio $USER\n`;
  message += `  2. Install udev rule: sudo tee /etc/udev/rules.d/99-pwm.rules << 'EOF'\n`;
  message += `     SUBSYSTEM=="pwm*", PROGRAM="/bin/sh -c 'chown -R root:gpio /sys/class/pwm && chmod -R 770 /sys/class/pwm; chown -R root:gpio /sys/devices/platform/soc/*.pwm/pwm/pwmchip* 2>/dev/null; chmod -R 770 /sys/devices/platform/soc/*.pwm/pwm/pwmchip* 2>/dev/null'\n`;
  message += `     EOF\n`;
  message += `  3. Reload udev: sudo udevadm control --reload-rules && sudo udevadm trigger\n`;
  message += `  4. Log out and back in\n\n`;
  message += `See README.md for detailed instructions.`;

  return message;
}

// Note: Using Node.js fs module for synchronous sysfs operations
// Bun's file API is async, but sysfs requires synchronous writes

// =============================================================================
// PWMChannel Class
// =============================================================================

/**
 * Hardware PWM channel for controlling motors, LEDs, servos, etc.
 */
export class PWMChannel {
  private channelPath: string;
  private _channel: number;
  private _periodNs: number;
  private _dutyCycle: number;
  private _closed: boolean = false;

  /** @internal */
  constructor(
    chipPath: string,
    channel: number,
    periodNs: number,
    dutyCycle: number
  ) {
    this.channelPath = `${chipPath}/pwm${channel}`;
    this._channel = channel;
    this._periodNs = periodNs;
    this._dutyCycle = dutyCycle;
  }

  /** The PWM channel number */
  get channel(): number {
    return this._channel;
  }

  /** Current period in nanoseconds */
  get periodNs(): number {
    return this._periodNs;
  }

  /** Current duty cycle (0-1) */
  get dutyCycle(): number {
    return this._dutyCycle;
  }

  /** Current frequency in Hz */
  get frequencyHz(): number {
    return 1_000_000_000 / this._periodNs;
  }

  /** Check if the channel has been closed */
  get closed(): boolean {
    return this._closed;
  }

  private checkClosed(): void {
    if (this._closed) {
      throw new Error(`PWMChannel on channel ${this._channel} has been closed`);
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

    // Convert ratio to nanoseconds based on current period
    const dutyCycleNs = Math.round(this._periodNs * ratio);

    // Write to sysfs (synchronous write required)
    fsWriteFileSync(
      `${this.channelPath}/duty_cycle`,
      String(dutyCycleNs),
      "utf8"
    );

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

    // Calculate period in nanoseconds
    const periodNs = Math.round(1_000_000_000 / frequencyHz);

    // Update period
    fsWriteFileSync(`${this.channelPath}/period`, String(periodNs), "utf8");

    // Update duty cycle to maintain the same ratio
    const dutyCycleNs = Math.round(periodNs * this._dutyCycle);
    fsWriteFileSync(
      `${this.channelPath}/duty_cycle`,
      String(dutyCycleNs),
      "utf8"
    );

    this._periodNs = periodNs;
    return this;
  }

  /**
   * Release the PWM channel
   */
  close(): void {
    if (!this._closed) {
      // Disable PWM before closing (like GPIO turns off before closing)
      try {
        fsWriteFileSync(`${this.channelPath}/enable`, "0", "utf8");
      } catch {
        // Ignore errors if channel is already closed/unexported
      }
      this._closed = true;
    }
  }
}

// =============================================================================
// PWM Controller Class
// =============================================================================

/**
 * Main PWM controller for a chip
 */
export class PWM {
  private chipPath: string;
  private channels: Map<number, PWMChannel> = new Map();
  private _closed: boolean = false;

  /**
   * Create a new PWM controller
   * @param chipPath Path to the PWM chip (e.g., "/sys/class/pwm/pwmchip0")
   */
  constructor(chipPath: string = "/sys/class/pwm/pwmchip0") {
    this.chipPath = chipPath;

    // Check if chip path exists
    if (!existsSync(chipPath)) {
      throw new Error(`PWM chip not found at ${chipPath}`);
    }

    // Check permissions on export file
    const exportPath = `${chipPath}/export`;
    if (!existsSync(exportPath)) {
      throw new Error(`Export file not found at ${exportPath}`);
    }

    if (!isWritable(exportPath)) {
      throw new Error(getPermissionErrorMessage(chipPath));
    }
  }

  /** Path to the PWM chip */
  get path(): string {
    return this.chipPath;
  }

  /** Check if the controller has been closed */
  get closed(): boolean {
    return this._closed;
  }

  private checkClosed(): void {
    if (this._closed) {
      throw new Error("PWM controller has been closed");
    }
  }

  /**
   * Check permissions for a PWM chip
   * @param chipPath Path to the PWM chip
   * @returns Permission check result
   */
  static checkPermissions(
    chipPath: string = "/sys/class/pwm/pwmchip0"
  ): PermissionCheckResult {
    const exportPath = `${chipPath}/export`;
    const canWrite = existsSync(exportPath) && isWritable(exportPath);
    const inGpioGroup = isInGpioGroup();

    let message = "";
    if (canWrite) {
      message = "PWM permissions are correctly configured.";
    } else {
      message = getPermissionErrorMessage(chipPath);
    }

    return {
      canWrite,
      inGpioGroup,
      message,
    };
  }

  /**
   * Create a PWM channel
   * @param channel Channel number (e.g., 0, 1)
   * @param options Channel configuration options
   */
  channel(channel: number, options: PWMChannelOptions = {}): PWMChannel {
    this.checkClosed();

    if (this.channels.has(channel)) {
      throw new Error(`PWM channel ${channel} is already in use`);
    }

    const { frequencyHz = 1000, dutyCycle = 0.5 } = options;

    // Validate inputs
    if (frequencyHz <= 0) {
      throw new Error("Frequency must be greater than 0");
    }
    if (dutyCycle < 0 || dutyCycle > 1) {
      throw new Error("Duty cycle must be between 0 and 1");
    }

    // Calculate period in nanoseconds
    const periodNs = Math.round(1_000_000_000 / frequencyHz);

    // Channel path
    const channelPath = `${this.chipPath}/pwm${channel}`;
    let channelAlreadyExported = false;

    // Export the channel (or reuse if already exported)
    const exportPath = `${this.chipPath}/export`;
    try {
      fsWriteFileSync(exportPath, String(channel), "utf8");
    } catch (error) {
      // Check if channel is already exported (EBUSY)
      if (existsSync(channelPath)) {
        // Channel already exists, we can reuse it
        channelAlreadyExported = true;
      } else {
        throw new Error(
          `Failed to export PWM channel ${channel}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Wait for the channel directory to be created
    if (!channelAlreadyExported) {
      let retries = 10;
      while (!existsSync(channelPath) && retries > 0) {
        Bun.sleepSync(10); // 10ms
        retries--;
      }

      if (!existsSync(channelPath)) {
        // Try to unexport in case it was partially created
        try {
          fsWriteFileSync(`${this.chipPath}/unexport`, String(channel), "utf8");
        } catch {
          // Ignore unexport errors
        }
        throw new Error(`Failed to create PWM channel ${channel} (timeout)`);
      }
    }

    // Wait for udev to set permissions (period file must be writable)
    const periodPath = `${channelPath}/period`;
    let permRetries = 50; // 50 * 20ms = 1 second max
    while (permRetries > 0) {
      try {
        accessSync(periodPath, constants.W_OK);
        break; // Permissions are set, we can proceed
      } catch {
        Bun.sleepSync(20); // 20ms
        permRetries--;
      }
    }

    if (permRetries === 0) {
      throw new Error(
        `Permission denied: Cannot write to ${periodPath}\n` +
          `The udev rule may not have set permissions yet, or you may need to run:\n` +
          `  sudo bash scripts/setup-pwm-permissions.sh`
      );
    }

    // Create the channel object
    const pwmChannel = new PWMChannel(
      this.chipPath,
      channel,
      periodNs,
      dutyCycle
    );

    // Set period and duty cycle
    fsWriteFileSync(`${channelPath}/period`, String(periodNs), "utf8");
    const dutyCycleNs = Math.round(periodNs * dutyCycle);
    fsWriteFileSync(`${channelPath}/duty_cycle`, String(dutyCycleNs), "utf8");

    // Enable the channel (always enabled, like GPIO outputs)
    fsWriteFileSync(`${channelPath}/enable`, "1", "utf8");

    // Track the channel
    this.channels.set(channel, pwmChannel);

    return pwmChannel;
  }

  /**
   * Close all PWM channels and release resources
   */
  close(): void {
    if (!this._closed) {
      // Close all channels
      for (const [channel, pwmChannel] of this.channels) {
        if (!pwmChannel.closed) {
          pwmChannel.close();
        }

        // Unexport the channel
        try {
          fsWriteFileSync(`${this.chipPath}/unexport`, String(channel), "utf8");
        } catch (error) {
          // Ignore unexport errors (channel might already be unexported)
        }
      }

      this.channels.clear();
      this._closed = true;
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default PWM;
