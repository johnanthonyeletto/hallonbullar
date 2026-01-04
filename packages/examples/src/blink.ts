import { GPIO } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");

const led = chip.output(17);

led.on();

setInterval(() => {
  led.toggle();
}, 100);

process.on("SIGINT", () => {
  led.off();
  chip.close();
  process.exit(0);
});
