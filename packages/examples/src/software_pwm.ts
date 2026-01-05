import { GPIO, SoftwarePWM } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");

const led = chip.output(17);

const pwm = new SoftwarePWM(led);

process.on("SIGINT", () => {
  pwm.setDutyCycle(0);
  pwm.close();
  chip.close();
  process.exit(0);
});

// Fade the LED in and out
let isIncreasing = true;
setInterval(() => {
  const next =
    Math.round((pwm.dutyCycle + (isIncreasing ? 0.01 : -0.01)) * 100) / 100;

  pwm.setDutyCycle(Math.max(0, Math.min(1, next)));

  if (pwm.dutyCycle >= 1) {
    isIncreasing = false;
  }
  if (pwm.dutyCycle <= 0) {
    isIncreasing = true;
  }
}, 100);
