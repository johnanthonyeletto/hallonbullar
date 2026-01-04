/**
 * Simple GPIO abstraction for Bun on Linux
 *
 * Provides easy-to-use GPIOOutput and GPIOInput classes built on libgpiod v2.
 *
 * @example
 * ```typescript
 * const gpio = new GPIO("/dev/gpiochip0");
 *
 * const led = gpio.output(17);
 * led.on();
 * led.off();
 * led.toggle();
 *
 * const button = gpio.input(27, { bias: "pull-up", edge: "falling" });
 * button.onEdge((event) => console.log(event));
 *
 * gpio.close();
 * ```
 */

import {
  loadLibgpiod,
  cstr,
  type Libgpiod,
  GPIOD_LINE_DIRECTION,
  GPIOD_LINE_EDGE,
  GPIOD_LINE_BIAS,
  GPIOD_LINE_VALUE,
  GPIOD_EDGE_EVENT_TYPE,
  type GpiodLineEdge,
  type GpiodLineBias,
} from "./libgpiod";

import { ptr, type Pointer } from "bun:ffi";

// =============================================================================
// Types
// =============================================================================

/** Bias configuration for input pins */
export type BiasSetting = "disabled" | "pull-up" | "pull-down";

/** Edge detection configuration */
export type EdgeSetting = "none" | "rising" | "falling" | "both";

/** Options for GPIO input */
export interface GPIOInputOptions {
  /** Internal bias resistor setting */
  bias?: BiasSetting;
  /** Edge detection for events */
  edge?: EdgeSetting;
  /** Treat the signal as active-low */
  activeLow?: boolean;
  /** Debounce period in milliseconds */
  debounceMs?: number;
}

/** Options for GPIO output */
export interface GPIOOutputOptions {
  /** Initial state of the output */
  initialValue?: boolean;
  /** Treat the signal as active-low */
  activeLow?: boolean;
}

/** Edge event from a GPIO input */
export interface EdgeEvent {
  /** Type of edge detected */
  type: "rising" | "falling";
  /** Timestamp in nanoseconds */
  timestampNs: bigint;
  /** GPIO pin that triggered the event */
  pin: number;
  /** Sequence number for this pin */
  sequence: bigint;
}

/** Callback for edge events */
export type EdgeCallback = (event: EdgeEvent) => void;

// =============================================================================
// Helper Functions
// =============================================================================

function biasToGpiod(bias: BiasSetting): GpiodLineBias {
  switch (bias) {
    case "disabled":
      return GPIOD_LINE_BIAS.DISABLED;
    case "pull-up":
      return GPIOD_LINE_BIAS.PULL_UP;
    case "pull-down":
      return GPIOD_LINE_BIAS.PULL_DOWN;
    default:
      return GPIOD_LINE_BIAS.DISABLED;
  }
}

function edgeToGpiod(edge: EdgeSetting): GpiodLineEdge {
  switch (edge) {
    case "none":
      return GPIOD_LINE_EDGE.NONE;
    case "rising":
      return GPIOD_LINE_EDGE.RISING;
    case "falling":
      return GPIOD_LINE_EDGE.FALLING;
    case "both":
      return GPIOD_LINE_EDGE.BOTH;
    default:
      return GPIOD_LINE_EDGE.NONE;
  }
}

// =============================================================================
// GPIOOutput Class
// =============================================================================

/**
 * Digital output pin for controlling LEDs, relays, etc.
 */
export class GPIOOutput {
  private lib: Libgpiod;
  private request: Pointer;
  private _pin: number;
  private _state: boolean;
  private _closed: boolean = false;

  /** @internal */
  constructor(
    lib: Libgpiod,
    request: Pointer,
    pin: number,
    initialState: boolean
  ) {
    this.lib = lib;
    this.request = request;
    this._pin = pin;
    this._state = initialState;
  }

  /** The GPIO pin number */
  get pin(): number {
    return this._pin;
  }

  /** Current state of the output */
  get state(): boolean {
    return this._state;
  }

  /** Check if the output has been closed */
  get closed(): boolean {
    return this._closed;
  }

  private checkClosed(): void {
    if (this._closed) {
      throw new Error(`GPIOOutput on pin ${this._pin} has been closed`);
    }
  }

  /** Turn the output on (high) */
  on(): this {
    this.checkClosed();
    this.lib.symbols.gpiod_line_request_set_value(
      this.request,
      this._pin,
      GPIOD_LINE_VALUE.ACTIVE
    );
    this._state = true;
    return this;
  }

  /** Turn the output off (low) */
  off(): this {
    this.checkClosed();
    this.lib.symbols.gpiod_line_request_set_value(
      this.request,
      this._pin,
      GPIOD_LINE_VALUE.INACTIVE
    );
    this._state = false;
    return this;
  }

  /** Toggle the output state */
  toggle(): this {
    this.checkClosed();
    if (this._state) {
      this.off();
    } else {
      this.on();
    }
    return this;
  }

  /** Write a boolean value to the output */
  write(value: boolean): this {
    this.checkClosed();
    if (value) {
      this.on();
    } else {
      this.off();
    }
    return this;
  }

  /** Release the GPIO line */
  close(): void {
    if (!this._closed) {
      this.lib.symbols.gpiod_line_request_release(this.request);
      this._closed = true;
    }
  }
}

// =============================================================================
// GPIOInput Class
// =============================================================================

/**
 * Digital input pin for reading buttons, sensors, etc.
 */
export class GPIOInput {
  private lib: Libgpiod;
  private request: Pointer;
  private _pin: number;
  private _edge: EdgeSetting;
  private _closed: boolean = false;
  private eventBuffer: Pointer | null = null;
  private edgeCallbacks: EdgeCallback[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  /** @internal */
  constructor(lib: Libgpiod, request: Pointer, pin: number, edge: EdgeSetting) {
    this.lib = lib;
    this.request = request;
    this._pin = pin;
    this._edge = edge;

    // Create event buffer if edge detection is enabled
    if (edge !== "none") {
      this.eventBuffer = lib.symbols.gpiod_edge_event_buffer_new(16);
    }
  }

  /** The GPIO pin number */
  get pin(): number {
    return this._pin;
  }

  /** Check if the input has been closed */
  get closed(): boolean {
    return this._closed;
  }

  /** Edge detection setting */
  get edge(): EdgeSetting {
    return this._edge;
  }

  private checkClosed(): void {
    if (this._closed) {
      throw new Error(`GPIOInput on pin ${this._pin} has been closed`);
    }
  }

  /** Read the current value of the input */
  read(): boolean {
    this.checkClosed();
    const value = this.lib.symbols.gpiod_line_request_get_value(
      this.request,
      this._pin
    );
    if (value < 0) {
      throw new Error(`Failed to read GPIO pin ${this._pin}`);
    }
    return value === GPIOD_LINE_VALUE.ACTIVE;
  }

  /** Alias for read() */
  get value(): boolean {
    return this.read();
  }

  /**
   * Register a callback for edge events.
   * Starts polling automatically when the first callback is registered.
   */
  onEdge(callback: EdgeCallback): this {
    this.checkClosed();
    if (this._edge === "none") {
      throw new Error("Edge detection is not enabled for this input");
    }

    this.edgeCallbacks.push(callback);

    // Start polling if not already started
    if (this.pollInterval === null) {
      this.startPolling();
    }

    return this;
  }

  /**
   * Remove an edge callback
   */
  offEdge(callback: EdgeCallback): this {
    const index = this.edgeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.edgeCallbacks.splice(index, 1);
    }

    // Stop polling if no callbacks remain
    if (this.edgeCallbacks.length === 0 && this.pollInterval !== null) {
      this.stopPolling();
    }

    return this;
  }

  /**
   * Wait for a single edge event
   * @param timeoutMs Timeout in milliseconds (default: wait forever)
   */
  async waitForEdge(timeoutMs?: number): Promise<EdgeEvent | null> {
    this.checkClosed();
    if (this._edge === "none") {
      throw new Error("Edge detection is not enabled for this input");
    }

    const timeoutNs =
      timeoutMs !== undefined ? BigInt(timeoutMs) * 1_000_000n : -1n;

    const result = this.lib.symbols.gpiod_line_request_wait_edge_events(
      this.request,
      timeoutNs
    );

    if (result < 0) {
      throw new Error("Error waiting for edge events");
    }

    if (result === 0) {
      return null; // Timeout
    }

    // Read the event
    const count = this.lib.symbols.gpiod_line_request_read_edge_events(
      this.request,
      this.eventBuffer!,
      1
    );

    if (count < 1) {
      return null;
    }

    return this.readEventFromBuffer(0);
  }

  /**
   * Async iterator for edge events
   */
  async *edges(): AsyncGenerator<EdgeEvent, void, unknown> {
    this.checkClosed();
    if (this._edge === "none") {
      throw new Error("Edge detection is not enabled for this input");
    }

    while (!this._closed) {
      const event = await this.waitForEdge(100);
      if (event) {
        yield event;
      }
    }
  }

  private readEventFromBuffer(index: number): EdgeEvent {
    const event = this.lib.symbols.gpiod_edge_event_buffer_get_event(
      this.eventBuffer!,
      BigInt(index)
    );

    const eventType = this.lib.symbols.gpiod_edge_event_get_event_type(event);
    const timestampNs =
      this.lib.symbols.gpiod_edge_event_get_timestamp_ns(event);
    const lineOffset = this.lib.symbols.gpiod_edge_event_get_line_offset(event);
    const lineSeqno = this.lib.symbols.gpiod_edge_event_get_line_seqno(event);

    return {
      type:
        eventType === GPIOD_EDGE_EVENT_TYPE.RISING_EDGE ? "rising" : "falling",
      timestampNs,
      pin: lineOffset,
      sequence: lineSeqno,
    };
  }

  private startPolling(): void {
    this.pollInterval = setInterval(() => {
      if (this._closed || this.edgeCallbacks.length === 0) {
        this.stopPolling();
        return;
      }

      // Check for events with no wait
      const result = this.lib.symbols.gpiod_line_request_wait_edge_events(
        this.request,
        0n // Don't block
      );

      if (result > 0) {
        // Read all available events
        const count = this.lib.symbols.gpiod_line_request_read_edge_events(
          this.request,
          this.eventBuffer!,
          16
        );

        for (let i = 0; i < count; i++) {
          const event = this.readEventFromBuffer(i);
          for (const callback of this.edgeCallbacks) {
            try {
              callback(event);
            } catch (err) {
              console.error("Error in edge callback:", err);
            }
          }
        }
      }
    }, 1); // Poll every 1ms
  }

  private stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /** Release the GPIO line */
  close(): void {
    if (!this._closed) {
      this.stopPolling();
      if (this.eventBuffer) {
        this.lib.symbols.gpiod_edge_event_buffer_free(this.eventBuffer);
        this.eventBuffer = null;
      }
      this.lib.symbols.gpiod_line_request_release(this.request);
      this._closed = true;
      this.edgeCallbacks = [];
    }
  }
}

// =============================================================================
// GPIO Controller Class
// =============================================================================

/**
 * Main GPIO controller for a chip
 */
export class GPIO {
  private lib: Libgpiod;
  private chip: Pointer;
  private _path: string;
  private _closed: boolean = false;
  private outputs: GPIOOutput[] = [];
  private inputs: GPIOInput[] = [];

  /**
   * Create a new GPIO controller
   * @param chipPath Path to the GPIO chip (e.g., "/dev/gpiochip0")
   * @param libraryPath Optional path to libgpiod shared library
   */
  constructor(
    chipPath: string = "/dev/gpiochip0",
    libraryPath: string = "/lib/aarch64-linux-gnu/libgpiod.so.3"
  ) {
    this.lib = loadLibgpiod(libraryPath);
    this._path = chipPath;

    const chip = this.lib.symbols.gpiod_chip_open(cstr(chipPath));
    if (!chip) {
      throw new Error(`Failed to open GPIO chip at ${chipPath}`);
    }
    this.chip = chip;
  }

  /** Path to the GPIO chip */
  get path(): string {
    return this._path;
  }

  /** Check if the controller has been closed */
  get closed(): boolean {
    return this._closed;
  }

  private checkClosed(): void {
    if (this._closed) {
      throw new Error("GPIO controller has been closed");
    }
  }

  /**
   * Get information about the chip
   */
  getChipInfo(): {
    name: string | null;
    label: string | null;
    numLines: number;
  } {
    this.checkClosed();
    const info = this.lib.symbols.gpiod_chip_get_info(this.chip);
    if (!info) {
      throw new Error("Failed to get chip info");
    }

    const nameResult = this.lib.symbols.gpiod_chip_info_get_name(info);
    const labelResult = this.lib.symbols.gpiod_chip_info_get_label(info);
    const result = {
      name: nameResult ? String(nameResult) : null,
      label: labelResult ? String(labelResult) : null,
      numLines: Number(this.lib.symbols.gpiod_chip_info_get_num_lines(info)),
    };

    this.lib.symbols.gpiod_chip_info_free(info);
    return result;
  }

  /**
   * Get information about a specific line
   */
  getLineInfo(pin: number): {
    offset: number;
    name: string | null;
    used: boolean;
    consumer: string | null;
    direction: "input" | "output";
  } {
    this.checkClosed();
    const info = this.lib.symbols.gpiod_chip_get_line_info(this.chip, pin);
    if (!info) {
      throw new Error(`Failed to get line info for pin ${pin}`);
    }

    const direction = this.lib.symbols.gpiod_line_info_get_direction(info);
    const nameResult = this.lib.symbols.gpiod_line_info_get_name(info);
    const consumerResult = this.lib.symbols.gpiod_line_info_get_consumer(info);

    const result = {
      offset: this.lib.symbols.gpiod_line_info_get_offset(info),
      name: nameResult ? String(nameResult) : null,
      used: this.lib.symbols.gpiod_line_info_is_used(info),
      consumer: consumerResult ? String(consumerResult) : null,
      direction:
        direction === GPIOD_LINE_DIRECTION.INPUT
          ? ("input" as const)
          : ("output" as const),
    };

    this.lib.symbols.gpiod_line_info_free(info);
    return result;
  }

  /**
   * Find a pin number by its name
   */
  findPin(name: string): number {
    this.checkClosed();
    const offset = this.lib.symbols.gpiod_chip_get_line_offset_from_name(
      this.chip,
      cstr(name)
    );
    if (offset < 0) {
      throw new Error(`Pin not found: ${name}`);
    }
    return offset;
  }

  /**
   * Create a digital output
   */
  output(pin: number, options: GPIOOutputOptions = {}): GPIOOutput {
    this.checkClosed();
    const { initialValue = false, activeLow = false } = options;

    // Create settings
    const settings = this.lib.symbols.gpiod_line_settings_new();
    if (!settings) {
      throw new Error("Failed to create line settings");
    }

    this.lib.symbols.gpiod_line_settings_set_direction(
      settings,
      GPIOD_LINE_DIRECTION.OUTPUT
    );
    this.lib.symbols.gpiod_line_settings_set_output_value(
      settings,
      initialValue ? GPIOD_LINE_VALUE.ACTIVE : GPIOD_LINE_VALUE.INACTIVE
    );
    this.lib.symbols.gpiod_line_settings_set_active_low(settings, activeLow);

    // Create line config
    const lineConfig = this.lib.symbols.gpiod_line_config_new();
    if (!lineConfig) {
      this.lib.symbols.gpiod_line_settings_free(settings);
      throw new Error("Failed to create line config");
    }

    const offsets = new Uint32Array([pin]);
    this.lib.symbols.gpiod_line_config_add_line_settings(
      lineConfig,
      ptr(offsets.buffer),
      1,
      settings
    );

    // Create request config
    const reqConfig = this.lib.symbols.gpiod_request_config_new();
    if (!reqConfig) {
      this.lib.symbols.gpiod_line_settings_free(settings);
      this.lib.symbols.gpiod_line_config_free(lineConfig);
      throw new Error("Failed to create request config");
    }
    this.lib.symbols.gpiod_request_config_set_consumer(
      reqConfig,
      cstr("bun-gpio")
    );

    // Request lines
    const request = this.lib.symbols.gpiod_chip_request_lines(
      this.chip,
      reqConfig,
      lineConfig
    );

    // Cleanup config objects
    this.lib.symbols.gpiod_line_settings_free(settings);
    this.lib.symbols.gpiod_line_config_free(lineConfig);
    this.lib.symbols.gpiod_request_config_free(reqConfig);

    if (!request) {
      throw new Error(`Failed to request GPIO pin ${pin} as output`);
    }

    const output = new GPIOOutput(this.lib, request, pin, initialValue);
    this.outputs.push(output);
    return output;
  }

  /**
   * Create a digital input
   */
  input(pin: number, options: GPIOInputOptions = {}): GPIOInput {
    this.checkClosed();
    const {
      bias = "disabled",
      edge = "none",
      activeLow = false,
      debounceMs = 0,
    } = options;

    // Create settings
    const settings = this.lib.symbols.gpiod_line_settings_new();
    if (!settings) {
      throw new Error("Failed to create line settings");
    }

    this.lib.symbols.gpiod_line_settings_set_direction(
      settings,
      GPIOD_LINE_DIRECTION.INPUT
    );
    this.lib.symbols.gpiod_line_settings_set_bias(settings, biasToGpiod(bias));
    this.lib.symbols.gpiod_line_settings_set_edge_detection(
      settings,
      edgeToGpiod(edge)
    );
    this.lib.symbols.gpiod_line_settings_set_active_low(settings, activeLow);

    if (debounceMs > 0) {
      this.lib.symbols.gpiod_line_settings_set_debounce_period_us(
        settings,
        BigInt(debounceMs * 1000)
      );
    }

    // Create line config
    const lineConfig = this.lib.symbols.gpiod_line_config_new();
    if (!lineConfig) {
      this.lib.symbols.gpiod_line_settings_free(settings);
      throw new Error("Failed to create line config");
    }

    const offsets = new Uint32Array([pin]);
    this.lib.symbols.gpiod_line_config_add_line_settings(
      lineConfig,
      ptr(offsets.buffer),
      1,
      settings
    );

    // Create request config
    const reqConfig = this.lib.symbols.gpiod_request_config_new();
    if (!reqConfig) {
      this.lib.symbols.gpiod_line_settings_free(settings);
      this.lib.symbols.gpiod_line_config_free(lineConfig);
      throw new Error("Failed to create request config");
    }
    this.lib.symbols.gpiod_request_config_set_consumer(
      reqConfig,
      cstr("bun-gpio")
    );

    // Request lines
    const request = this.lib.symbols.gpiod_chip_request_lines(
      this.chip,
      reqConfig,
      lineConfig
    );

    // Cleanup config objects
    this.lib.symbols.gpiod_line_settings_free(settings);
    this.lib.symbols.gpiod_line_config_free(lineConfig);
    this.lib.symbols.gpiod_request_config_free(reqConfig);

    if (!request) {
      throw new Error(`Failed to request GPIO pin ${pin} as input`);
    }

    const input = new GPIOInput(this.lib, request, pin, edge);
    this.inputs.push(input);
    return input;
  }

  /**
   * Close all GPIO resources
   */
  close(): void {
    if (!this._closed) {
      // Close all outputs
      for (const output of this.outputs) {
        if (!output.closed) {
          output.close();
        }
      }
      this.outputs = [];

      // Close all inputs
      for (const input of this.inputs) {
        if (!input.closed) {
          input.close();
        }
      }
      this.inputs = [];

      // Close chip
      this.lib.symbols.gpiod_chip_close(this.chip);
      this._closed = true;
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default GPIO;
