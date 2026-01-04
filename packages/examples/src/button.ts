import { GPIO } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");

const led = chip.output(17);
const button = chip.input(18, { edge: "falling" });

button.onEdge((event) => {
  console.log(`Button pressed: ${event.type}`);
  led.write(!led.state);
});

// Cleanup on exit
process.on("SIGINT", () => {
  led.off();
  chip.close();
  process.exit(0);
});
