import { PWM } from "hallonbullar";

process.on("SIGINT", () => {
  led.setDutyCycle(0);
  pwm.close();
  process.exit(0);
});

const pwm = new PWM();

// On Raspberry Pi 5: GPIO 18 = PWM channel 2
const led = pwm.channel(2, {
  frequencyHz: 1000,
  dutyCycle: 0,
});

// Fade the LED in and out
let isIncreasing = true;
setInterval(() => {
  const next =
    Math.round((led.dutyCycle + (isIncreasing ? 0.01 : -0.01)) * 100) / 100;

  led.setDutyCycle(Math.max(0, Math.min(1, next)));
  if (led.dutyCycle >= 1) {
    isIncreasing = false;
  }
  if (led.dutyCycle <= 0) {
    isIncreasing = true;
  }
}, 10);
