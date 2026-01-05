import { GPIO, SoftwarePWM } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");

const red = new SoftwarePWM(chip.output(18));
const green = new SoftwarePWM(chip.output(12));
const blue = new SoftwarePWM(chip.output(17));

process.on("SIGINT", () => {
  red.close();
  green.close();
  blue.close();
  chip.close();
});

Bun.serve({
  port: 3000,
  fetch: (req, server) => {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 500 });
    }

    if (url.pathname === "/") {
      return new Response(Bun.file(`${import.meta.dir}/index.html`), {
        headers: {
          "Content-Type": "text/html",
        },
      });
    }

    return Response.json({ message: "Hello, world!" });
  },
  websocket: {
    message: (ws, message) => {
      try {
        // Parse RGB string like "rgb(255, 233, 0)"
        const rgbString = message.toString();
        const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);

          // Convert RGB (0-255) to duty cycle (0-1), inverted for common anode LEDs
          const redValue = 1 - r / 255;
          const greenValue = 1 - g / 255;
          const blueValue = 1 - b / 255;

          red.setDutyCycle(redValue);
          green.setDutyCycle(greenValue);
          blue.setDutyCycle(blueValue);
        } else {
          console.warn(`Invalid RGB format: ${rgbString}`);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    },
    open: (ws) => {
      console.log("WebSocket connection opened");
    },
    close: (ws) => {
      console.log("WebSocket connection closed");
    },
  },
});
