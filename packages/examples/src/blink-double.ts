import { GPIO } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");

const led1 = chip.output(17);
const led2 = chip.output(27);
led1.on();
led2.off();

setInterval(() => {
  led1.toggle();
  led2.toggle();
}, 5000);

process.on("SIGINT", () => {
  led1.off();
  led2.off();
  chip.close();
  process.exit(0);
});
