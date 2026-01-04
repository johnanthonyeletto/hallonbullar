# Hallonbullar

**Hallonbullar** (Swedish for "raspberry buns") is a GPIO and PWM control library for Raspberry Pi, written with [Bun](https://bun.sh). The name is a playful pun: **raspberry bun** = Raspberry Pi + Bun runtime.

Hallonbullar are Swedish raspberry buns made from a sweet yeasted wheat dough enriched with butter, sugar, and often cardamom. They feature a buttery filling mixed with fresh or frozen raspberries, folded into the dough and shaped into twists or knots before baking. These treats are popular in Sweden, especially during raspberry season in mid to late summer.

## Overview

Hallonbullar provides a simple, TypeScript-friendly API for controlling GPIO pins and PWM channels on Raspberry Pi. It's built on top of:

- **libgpiod v2** for GPIO control (via FFI bindings)
- **Linux sysfs PWM interface** for hardware PWM

> **⚠️ Important**: This library **only works with Bun runtime**. It does **not** work with Node.js. The library uses Bun-specific features like `bun:ffi` for native bindings and Bun's file system APIs.

The library is designed to be:
- **Simple**: Easy-to-use classes and methods
- **Type-safe**: Full TypeScript support
- **Bun-only**: Built specifically for Bun runtime (not compatible with Node.js)
- **Efficient**: Direct hardware access with minimal overhead

## Repository Structure

This repository contains:

- **`packages/hallonbullar/`** - The main library package
- **`packages/examples/`** - Example projects demonstrating usage

## Installation

**Prerequisites**: Make sure you have [Bun](https://bun.sh) installed. This library requires Bun and will not work with Node.js.

```bash
# Clone the repository
git clone <repository-url>
cd bun-blink

# Install dependencies (if using a workspace manager)
bun install
```

## Requirements

- **Raspberry Pi** (tested on Raspberry Pi 5, should work on other models)
- **Bun runtime** (latest version) - **Required**: This library does not work with Node.js
- **libgpiod v2** (`libgpiod.so.3`)
- **Linux kernel** with GPIO and PWM support
- **Permissions**: User must be in the `gpio` group (see Setup below)

> **Note**: This library requires Bun and will not work with Node.js. It uses Bun-specific APIs like `bun:ffi` for native library bindings.

## Setup

### GPIO Permissions

For GPIO access, add your user to the `gpio` group:

```bash
sudo usermod -aG gpio $USER
```

Then log out and log back in for the changes to take effect.

### PWM Permissions

For PWM access, you may need to set up udev rules. The library will provide helpful error messages if permissions are not configured correctly.

## Quick Start

### GPIO - Blink an LED

```typescript
import { GPIO } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");
const led = chip.output(17);

led.on();

setInterval(() => {
  led.toggle();
}, 100);

// Cleanup on exit
process.on("SIGINT", () => {
  led.off();
  chip.close();
  process.exit(0);
});
```

### PWM - Fade an LED

```typescript
import { PWM } from "hallonbullar";

const pwm = new PWM();
const led = pwm.channel(2, {
  frequencyHz: 1000,
  dutyCycle: 0.5,
});

// Fade in and out
let isIncreasing = true;
setInterval(() => {
  const next = led.dutyCycle + (isIncreasing ? 0.01 : -0.01);
  led.setDutyCycle(Math.max(0, Math.min(1, next)));
  
  if (led.dutyCycle >= 1) isIncreasing = false;
  if (led.dutyCycle <= 0) isIncreasing = true;
}, 10);
```

## API Documentation

### GPIO Module

The GPIO module provides digital input/output control using libgpiod v2.

#### `GPIO` Class

Main controller for a GPIO chip.

**Constructor:**
```typescript
new GPIO(chipPath?: string, libraryPath?: string)
```

- `chipPath`: Path to the GPIO chip (default: `"/dev/gpiochip0"`)
- `libraryPath`: Path to libgpiod shared library (default: `"/lib/aarch64-linux-gnu/libgpiod.so.3"`)

**Methods:**

- `output(pin: number, options?: GPIOOutputOptions): GPIOOutput`
  - Create a digital output pin
  - `options.initialValue`: Initial state (default: `false`)
  - `options.activeLow`: Treat signal as active-low (default: `false`)

- `input(pin: number, options?: GPIOInputOptions): GPIOInput`
  - Create a digital input pin
  - `options.bias`: Internal bias resistor - `"disabled" | "pull-up" | "pull-down"` (default: `"disabled"`)
  - `options.edge`: Edge detection - `"none" | "rising" | "falling" | "both"` (default: `"none"`)
  - `options.activeLow`: Treat signal as active-low (default: `false`)
  - `options.debounceMs`: Debounce period in milliseconds (default: `0`)

- `getChipInfo(): { name: string | null; label: string | null; numLines: number }`
  - Get information about the GPIO chip

- `getLineInfo(pin: number): { offset: number; name: string | null; used: boolean; consumer: string | null; direction: "input" | "output" }`
  - Get information about a specific GPIO line

- `findPin(name: string): number`
  - Find a pin number by its name

- `close(): void`
  - Close all GPIO resources and release pins

**Properties:**

- `path: string` - Path to the GPIO chip
- `closed: boolean` - Whether the controller has been closed

#### `GPIOOutput` Class

Digital output pin for controlling LEDs, relays, etc.

**Methods:**

- `on(): this` - Turn the output on (high)
- `off(): this` - Turn the output off (low)
- `toggle(): this` - Toggle the output state
- `write(value: boolean): this` - Write a boolean value to the output
- `close(): void` - Release the GPIO line

**Properties:**

- `pin: number` - The GPIO pin number
- `state: boolean` - Current state of the output
- `closed: boolean` - Whether the output has been closed

#### `GPIOInput` Class

Digital input pin for reading buttons, sensors, etc.

**Methods:**

- `read(): boolean` - Read the current value of the input
- `value: boolean` - Alias for `read()` (getter)
- `onEdge(callback: EdgeCallback): this` - Register a callback for edge events
- `offEdge(callback: EdgeCallback): this` - Remove an edge callback
- `waitForEdge(timeoutMs?: number): Promise<EdgeEvent | null>` - Wait for a single edge event
- `edges(): AsyncGenerator<EdgeEvent, void, unknown>` - Async iterator for edge events
- `close(): void` - Release the GPIO line

**Properties:**

- `pin: number` - The GPIO pin number
- `edge: EdgeSetting` - Edge detection setting
- `closed: boolean` - Whether the input has been closed

**Types:**

```typescript
interface EdgeEvent {
  type: "rising" | "falling";
  timestampNs: bigint;
  pin: number;
  sequence: bigint;
}

type EdgeCallback = (event: EdgeEvent) => void;
```

### PWM Module

The PWM module provides hardware PWM control using the Linux sysfs interface.

#### `PWM` Class

Main controller for a PWM chip.

**Constructor:**
```typescript
new PWM(chipPath?: string)
```

- `chipPath`: Path to the PWM chip (default: `"/sys/class/pwm/pwmchip0"`)

**Methods:**

- `channel(channel: number, options?: PWMChannelOptions): PWMChannel`
  - Create a PWM channel
  - `options.frequencyHz`: Initial frequency in Hz (default: `1000`)
  - `options.dutyCycle`: Initial duty cycle 0-1 (default: `0.5`)

- `checkPermissions(chipPath?: string): PermissionCheckResult`
  - Static method to check PWM permissions
  - Returns: `{ canWrite: boolean; inGpioGroup: boolean; message: string }`

- `close(): void`
  - Close all PWM channels and release resources

**Properties:**

- `path: string` - Path to the PWM chip
- `closed: boolean` - Whether the controller has been closed

#### `PWMChannel` Class

Hardware PWM channel for controlling motors, LEDs, servos, etc.

**Methods:**

- `setDutyCycle(ratio: number): this` - Set the duty cycle (0-1)
- `setFrequency(frequencyHz: number): this` - Set the frequency in Hz
- `close(): void` - Release the PWM channel (disables output)

**Properties:**

- `channel: number` - The PWM channel number
- `periodNs: number` - Current period in nanoseconds
- `dutyCycle: number` - Current duty cycle (0-1)
- `frequencyHz: number` - Current frequency in Hz
- `closed: boolean` - Whether the channel has been closed

## Examples

The `packages/examples/` directory contains several example projects:

### Basic Examples

- **`blink.ts`** - Simple LED blinking
- **`blink-double.ts`** - Two LEDs alternating
- **`button.ts`** - Button input with edge detection
- **`pwm_led.ts`** - PWM LED fading

### Web Example

- **`redlight-greenlight/`** - Web server controlling GPIO pins via HTTP endpoints

Run examples:

```bash
cd packages/examples
bun run src/blink.ts
```

## Error Handling

The library throws descriptive errors for common issues:

- **Permission errors**: Helpful messages about group membership and udev rules
- **Pin conflicts**: Clear errors when trying to use pins that are already in use
- **Invalid parameters**: Validation errors for out-of-range values

## Notes

- GPIO pins are automatically released when the `GPIO` controller is closed
- PWM channels are automatically disabled and unexported when closed
- Edge detection callbacks are polled every 1ms for responsiveness
- The library uses synchronous sysfs operations for PWM (required by the kernel interface)

## License

MIT License - see [LICENSE](LICENSE) file for details.

This library uses libgpiod (LGPL-2.1) via FFI bindings. The library itself is MIT licensed.

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork the repository** and create a branch for your changes
2. **Make your changes** - keep code style consistent with the existing codebase
3. **Test your changes** - make sure examples still work and test on a Raspberry Pi if possible
4. **Submit a pull request** with a clear description of what you changed and why

**Guidelines:**
- Code should be TypeScript and work with Bun (not Node.js)
- Keep the API simple and consistent with existing patterns
- Add examples if you're introducing new features
- Update documentation as needed

Thanks for contributing! 🍞

