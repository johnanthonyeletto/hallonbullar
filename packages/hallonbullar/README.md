# bun-gpio

A simple, modern GPIO library for Bun on Linux. Built on top of libgpiod v2 for reliable, kernel-supported GPIO access.

## Features

- **Simple API** - Easy-to-use `GPIOOutput`, `GPIOInput`, and `PWMChannel` classes
- **Edge detection** - Callbacks, promises, and async iterators for input events
- **Hardware PWM** - Full hardware PWM support for motors, servos, and dimming
- **Type-safe** - Full TypeScript support with detailed types
- **Modern** - Uses the Linux character device interface (not deprecated sysfs)
- **Flexible** - Configure bias, debounce, active-low, and more

## Requirements

- [Bun](https://bun.sh) runtime
- Linux with GPIO character device support (kernel 4.8+)
- libgpiod v2.x installed (`libgpiod.so.3`)

### Installing libgpiod

```bash
# Debian/Ubuntu
sudo apt install libgpiod2 libgpiod-dev

# Arch Linux
sudo pacman -S libgpiod

# Fedora
sudo dnf install libgpiod
```

## Installation

Copy `gpio.ts`, `libgpiod.ts`, and `pwm.ts` to your project:

```
your-project/
├── gpio.ts
├── libgpiod.ts
├── pwm.ts
└── your-code.ts
```

## Setup

### GPIO Permissions

GPIO access typically requires membership in the `gpio` group:

```bash
# Add your user to the gpio group
sudo usermod -aG gpio $USER
# Then log out and back in
```

### PWM Permissions

PWM requires additional udev rules. Run the setup script once:

```bash
sudo bash scripts/setup-pwm-permissions.sh
```

This script will:
- Install udev rules for PWM sysfs access
- Add your user to the `gpio` group (if not already)
- Reload udev rules

**Important:** After running the script, you must log out and log back in for group membership to take effect.

Alternatively, you can set up PWM permissions manually:

```bash
# 1. Add yourself to gpio group
sudo usermod -aG gpio $USER

# 2. Create udev rule
sudo tee /etc/udev/rules.d/99-pwm.rules << 'EOF'
SUBSYSTEM=="pwm*", PROGRAM="/bin/sh -c 'chown -R root:gpio /sys/class/pwm && chmod -R 770 /sys/class/pwm; chown -R root:gpio /sys/devices/platform/soc/*.pwm/pwm/pwmchip* 2>/dev/null; chmod -R 770 /sys/devices/platform/soc/*.pwm/pwm/pwmchip* 2>/dev/null'"
EOF

# 3. Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# 4. Log out and back in
```

## Quick Start

### Blink an LED

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const led = gpio.output(17);

// Blink every 500ms
setInterval(() => led.toggle(), 500);

// Cleanup on exit
process.on("SIGINT", () => {
  led.off();
  gpio.close();
  process.exit(0);
});
```

### Read a Button

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const button = gpio.input(27, { bias: "pull-up" });

// Poll the button
setInterval(() => {
  console.log("Button pressed:", !button.read());
}, 100);
```

### React to Button Presses

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const button = gpio.input(27, {
  bias: "pull-up",
  edge: "falling",
  debounceMs: 10,
});

button.onEdge((event) => {
  console.log("Button pressed!");
});
```

### Control a Motor with PWM

```typescript
import PWM from "./pwm.ts";

const pwm = new PWM("/sys/class/pwm/pwmchip0");
const motor = pwm.channel(0, {
  frequencyHz: 1000,  // 1kHz
  dutyCycle: 0.5,     // 50% power
  // Channel is immediately active (like GPIO outputs)
});

// Speed up
motor.setDutyCycle(0.75);  // 75% power

// Change frequency
motor.setFrequency(2000);   // 2kHz

// Cleanup
process.on("SIGINT", () => {
  pwm.close();
  process.exit(0);
});
```

## API Reference

### `GPIO` - Main Controller

```typescript
const gpio = new GPIO(chipPath?: string, libraryPath?: string);
```

| Parameter     | Default                                  | Description              |
| ------------- | ---------------------------------------- | ------------------------ |
| `chipPath`    | `"/dev/gpiochip0"`                       | Path to the GPIO chip    |
| `libraryPath` | `"/lib/aarch64-linux-gnu/libgpiod.so.3"` | Path to libgpiod library |

#### Methods

| Method                  | Returns      | Description                          |
| ----------------------- | ------------ | ------------------------------------ |
| `output(pin, options?)` | `GPIOOutput` | Create a digital output              |
| `input(pin, options?)`  | `GPIOInput`  | Create a digital input               |
| `getChipInfo()`         | `ChipInfo`   | Get chip name, label, and line count |
| `getLineInfo(pin)`      | `LineInfo`   | Get info about a specific GPIO line  |
| `findPin(name)`         | `number`     | Find a pin number by its name        |
| `close()`               | `void`       | Release all resources                |

---

### `GPIOOutput` - Digital Output

Control LEDs, relays, motors, and other output devices.

```typescript
const led = gpio.output(pin, options?);
```

#### Options

| Option         | Type      | Default | Description                 |
| -------------- | --------- | ------- | --------------------------- |
| `initialValue` | `boolean` | `false` | Initial state of the output |
| `activeLow`    | `boolean` | `false` | Invert the signal logic     |

#### Methods

| Method         | Returns | Description             |
| -------------- | ------- | ----------------------- |
| `on()`         | `this`  | Set output high         |
| `off()`        | `this`  | Set output low          |
| `toggle()`     | `this`  | Toggle the output state |
| `write(value)` | `this`  | Write a boolean value   |
| `close()`      | `void`  | Release this GPIO line  |

#### Properties

| Property | Type      | Description                          |
| -------- | --------- | ------------------------------------ |
| `pin`    | `number`  | The GPIO pin number                  |
| `state`  | `boolean` | Current output state                 |
| `closed` | `boolean` | Whether the output has been released |

---

### `GPIOInput` - Digital Input

Read buttons, switches, sensors, and other input devices.

```typescript
const button = gpio.input(pin, options?);
```

#### Options

| Option       | Type                                              | Default      | Description                       |
| ------------ | ------------------------------------------------- | ------------ | --------------------------------- |
| `bias`       | `"disabled"` \| `"pull-up"` \| `"pull-down"`      | `"disabled"` | Internal pull resistor            |
| `edge`       | `"none"` \| `"rising"` \| `"falling"` \| `"both"` | `"none"`     | Edge detection for events         |
| `activeLow`  | `boolean`                                         | `false`      | Invert the signal logic           |
| `debounceMs` | `number`                                          | `0`          | Hardware debounce in milliseconds |

#### Methods

| Method                    | Returns                      | Description                     |
| ------------------------- | ---------------------------- | ------------------------------- |
| `read()`                  | `boolean`                    | Read the current input value    |
| `onEdge(callback)`        | `this`                       | Register an edge event callback |
| `offEdge(callback)`       | `this`                       | Remove an edge event callback   |
| `waitForEdge(timeoutMs?)` | `Promise<EdgeEvent \| null>` | Wait for a single edge event    |
| `edges()`                 | `AsyncGenerator<EdgeEvent>`  | Async iterator for edge events  |
| `close()`                 | `void`                       | Release this GPIO line          |

#### Properties

| Property | Type          | Description                              |
| -------- | ------------- | ---------------------------------------- |
| `pin`    | `number`      | The GPIO pin number                      |
| `value`  | `boolean`     | Current input value (alias for `read()`) |
| `edge`   | `EdgeSetting` | Configured edge detection                |
| `closed` | `boolean`     | Whether the input has been released      |

---

### `EdgeEvent` - Edge Event Data

```typescript
interface EdgeEvent {
  type: "rising" | "falling"; // Edge type
  timestampNs: bigint; // Kernel timestamp in nanoseconds
  pin: number; // GPIO pin that triggered
  sequence: bigint; // Event sequence number for this pin
}
```

---

### `PWM` - PWM Controller

Control hardware PWM channels for motors, servos, LED dimming, etc.

```typescript
const pwm = new PWM(chipPath?);
```

| Parameter  | Default                    | Description              |
| ---------- | -------------------------- | ------------------------ |
| `chipPath` | `"/sys/class/pwm/pwmchip0"` | Path to the PWM chip     |

#### Methods

| Method                      | Returns      | Description                          |
| --------------------------- | ------------ | ------------------------------------ |
| `channel(channel, options?)` | `PWMChannel` | Create a PWM channel                 |
| `checkPermissions(chipPath?)` | `PermissionCheckResult` | Check if permissions are configured (static) |
| `close()`                   | `void`       | Release all resources                |

#### Properties

| Property | Type      | Description                          |
| -------- | --------- | ------------------------------------ |
| `path`   | `string`  | Path to the PWM chip                 |
| `closed` | `boolean` | Whether the controller has been closed |

---

### `PWMChannel` - PWM Output Channel

Control a single hardware PWM channel.

```typescript
const motor = pwm.channel(channel, options?);
```

#### Options

| Option        | Type      | Default | Description                          |
| ------------- | --------- | ------- | ------------------------------------ |
| `frequencyHz` | `number`  | `1000`  | Initial frequency in Hz              |
| `dutyCycle`   | `number`  | `0.5`   | Initial duty cycle (0-1)             |

#### Methods

| Method              | Returns | Description                          |
| ------------------- | ------- | ------------------------------------ |
| `setDutyCycle(0-1)` | `this`  | Set duty cycle as a ratio (0-1)     |
| `setFrequency(Hz)`  | `this`  | Set frequency in Hz                  |
| `close()`           | `void`  | Release this PWM channel             |

#### Properties

| Property     | Type      | Description                          |
| ------------ | --------- | ------------------------------------ |
| `channel`    | `number`  | The PWM channel number               |
| `periodNs`   | `number`  | Current period in nanoseconds        |
| `dutyCycle`  | `number`  | Current duty cycle (0-1)             |
| `frequencyHz` | `number`  | Current frequency in Hz               |
| `closed`     | `boolean` | Whether the channel has been released |

## Examples

### LED with Button Control

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const led = gpio.output(17);
const button = gpio.input(27, { bias: "pull-up", edge: "both" });

button.onEdge((event) => {
  if (event.type === "falling") {
    led.on();
  } else {
    led.off();
  }
});

process.on("SIGINT", () => gpio.close());
```

### Async/Await Button Handling

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const button = gpio.input(27, { bias: "pull-up", edge: "falling" });

async function main() {
  console.log("Waiting for button press...");

  const event = await button.waitForEdge(10000);

  if (event) {
    console.log("Button pressed!");
  } else {
    console.log("Timeout - no button press");
  }

  gpio.close();
}

main();
```

### Async Iterator for Events

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const button = gpio.input(27, { bias: "pull-up", edge: "both" });

async function main() {
  let count = 0;

  for await (const event of button.edges()) {
    console.log(`Event ${++count}: ${event.type}`);

    if (count >= 10) break;
  }

  gpio.close();
}

main();
```

### Multiple Outputs

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");

const leds = [gpio.output(17), gpio.output(27), gpio.output(22)];

// Chase pattern
let index = 0;
setInterval(() => {
  leds.forEach((led, i) => led.write(i === index));
  index = (index + 1) % leds.length;
}, 200);

process.on("SIGINT", () => gpio.close());
```

### Inspecting GPIO Lines

```typescript
import GPIO from "./gpio.ts";

const gpio = new GPIO("/dev/gpiochip0");
const info = gpio.getChipInfo();

console.log(`Chip: ${info.name} (${info.label})`);
console.log(`Lines: ${info.numLines}`);

for (let i = 0; i < info.numLines; i++) {
  const line = gpio.getLineInfo(i);
  const status = line.used ? `[${line.consumer}]` : "available";
  console.log(`  ${i}: ${line.name || "(unnamed)"} - ${status}`);
}

gpio.close();
```

### Servo Control with PWM

```typescript
import PWM from "./pwm.ts";

const pwm = new PWM("/sys/class/pwm/pwmchip0");
const servo = pwm.channel(0, {
  frequencyHz: 50,  // 50Hz for servos (20ms period)
  dutyCycle: 0.075, // 1.5ms pulse = 7.5% of 20ms (neutral position)
  // Channel is immediately active (like GPIO outputs)
});

// Move to 0 degrees (1ms pulse = 5%)
servo.setDutyCycle(0.05);

// Move to 90 degrees (1.5ms pulse = 7.5%)
servo.setDutyCycle(0.075);

// Move to 180 degrees (2ms pulse = 10%)
servo.setDutyCycle(0.10);

process.on("SIGINT", () => {
  pwm.close();
  process.exit(0);
});
```

### LED Dimming with PWM

```typescript
import PWM from "./pwm.ts";

const pwm = new PWM("/sys/class/pwm/pwmchip0");
const led = pwm.channel(0, {
  frequencyHz: 1000,  // 1kHz (fast enough to avoid flicker)
  dutyCycle: 0.5,     // Start at 50% brightness
  // Channel is immediately active (like GPIO outputs)
});

// Fade in
for (let i = 0; i <= 100; i++) {
  led.setDutyCycle(i / 100);
  await Bun.sleep(20); // 20ms delay
}

// Fade out
for (let i = 100; i >= 0; i--) {
  led.setDutyCycle(i / 100);
  await Bun.sleep(20);
}

pwm.close();
```

### Checking PWM Permissions

```typescript
import PWM from "./pwm.ts";

// Check permissions before using PWM
const status = PWM.checkPermissions("/sys/class/pwm/pwmchip0");

if (!status.canWrite) {
  console.error("PWM permissions not configured:");
  console.error(status.message);
  process.exit(1);
}

// Proceed with PWM usage
const pwm = new PWM("/sys/class/pwm/pwmchip0");
const motor = pwm.channel(0, { frequencyHz: 1000, dutyCycle: 0.5 });
```

## Finding Your GPIO Chip

Most single-board computers have one main GPIO chip at `/dev/gpiochip0`, but some have multiple. Use the `gpiodetect` command to list available chips:

```bash
$ gpiodetect
gpiochip0 [pinctrl-bcm2835] (54 lines)
gpiochip1 [raspberrypi-exp-gpio] (8 lines)
```

Use `gpioinfo` to see line names and current usage:

```bash
$ gpioinfo gpiochip0
```

## Finding Your PWM Chip

PWM chips are typically found at `/sys/class/pwm/pwmchip0`. List available PWM chips:

```bash
$ ls -la /sys/class/pwm/
pwmchip0
```

Check available channels on a chip:

```bash
$ ls -la /sys/class/pwm/pwmchip0/
npwm  export  unexport
```

The `npwm` file contains the number of available channels.

## Troubleshooting

### Permission Denied (GPIO)

GPIO access typically requires root or membership in the `gpio` group:

```bash
# Run as root
sudo bun run your-script.ts

# Or add your user to the gpio group
sudo usermod -aG gpio $USER
# Then log out and back in
```

### Permission Denied (PWM)

PWM requires additional udev rules. If you get permission errors:

1. **Run the setup script:**
   ```bash
   sudo bash scripts/setup-pwm-permissions.sh
   ```

2. **Log out and back in** (required for group membership to take effect)

3. **Verify permissions:**
   ```bash
   # Check if you're in gpio group
   groups
   
   # Check if PWM chip is accessible
   ls -la /sys/class/pwm/pwmchip0/
   ```

4. **Check permissions programmatically:**
   ```typescript
   import PWM from "./pwm.ts";
   const status = PWM.checkPermissions();
   console.log(status.message);
   ```

If you still have issues, ensure:
- The `gpio` group exists: `getent group gpio`
- You're in the group: `groups | grep gpio`
- The udev rule exists: `cat /etc/udev/rules.d/99-pwm.rules`
- udev rules were reloaded: `sudo udevadm control --reload-rules && sudo udevadm trigger`

### Library Not Found

If libgpiod is installed but not found, specify the library path:

```typescript
const gpio = new GPIO("/dev/gpiochip0", "/usr/lib/libgpiod.so.3");
```

Find the library location:

```bash
find /usr /lib -name "libgpiod.so*" 2>/dev/null
```

### Pin Already in Use

If a pin is already requested by another process, you'll get an error. Check what's using it:

```typescript
const info = gpio.getLineInfo(17);
if (info.used) {
  console.log(`Pin 17 is used by: ${info.consumer}`);
}
```

### PWM Channel Already in Use

If a PWM channel is already exported, you'll get an error. Check what's using it:

```bash
# List exported PWM channels
ls -la /sys/class/pwm/pwmchip0/pwm*

# Check if a specific channel is exported
ls -la /sys/class/pwm/pwmchip0/pwm0
```

To unexport a channel manually:

```bash
echo 0 > /sys/class/pwm/pwmchip0/unexport
```

### PWM Chip Not Found

If you get "PWM chip not found", check:

1. **PWM is enabled in device tree** (Raspberry Pi):
   ```bash
   # Check if PWM is enabled
   dtoverlay=pwm
   ```

2. **PWM chip exists:**
   ```bash
   ls -la /sys/class/pwm/
   ```

3. **Check kernel messages:**
   ```bash
   dmesg | grep pwm
   ```

## Platform Notes

### Raspberry Pi

- GPIO chip is typically `/dev/gpiochip0`
- PWM chip is typically `/sys/class/pwm/pwmchip0`
- Pin numbers are BCM GPIO numbers (not physical pin numbers)
- GPIO 2/3 have fixed pull-ups for I2C
- **PWM mapping:**
  - GPIO 12 (PWM0 channel 0) → `/sys/class/pwm/pwmchip0/pwm0`
  - GPIO 13 (PWM1 channel 1) → `/sys/class/pwm/pwmchip0/pwm1`
  - GPIO 18 (PWM0 channel 0) → `/sys/class/pwm/pwmchip0/pwm0` (alternative)
  - GPIO 19 (PWM1 channel 1) → `/sys/class/pwm/pwmchip0/pwm1` (alternative)
- **Enable PWM:** Add `dtoverlay=pwm` to `/boot/config.txt` and reboot

### Orange Pi / Other ARM SBCs

- May have multiple GPIO chips
- Check your board's documentation for pin mappings

## License

MIT

## Credits

- GPIO: Built on [libgpiod](https://git.kernel.org/pub/scm/libs/libgpiod/libgpiod.git/), the official Linux GPIO library
- PWM: Uses the Linux sysfs PWM interface (`/sys/class/pwm/`)
