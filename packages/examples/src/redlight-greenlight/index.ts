import { GPIO } from "hallonbullar";

const chip = new GPIO("/dev/gpiochip0");

const redLight = chip.output(17);
const greenLight = chip.output(27);
redLight.off();
greenLight.off();

process.on("SIGINT", () => {
  redLight.off();
  greenLight.off();
  chip.close();
  process.exit(0);
});

Bun.serve({
  port: 3000,
  routes: {
    "/": () => {
      return new Response(Bun.file(`${import.meta.dir}/index.html`), {
        headers: {
          "Content-Type": "text/html",
        },
      });
    },
    "/off": () => {
      redLight.off();
      greenLight.off();
      return Response.json({ message: "Lights off" });
    },
    "/red": () => {
      redLight.on();
      greenLight.off();
      return Response.json({ message: "Red light toggled" });
    },
    "/green": () => {
      greenLight.on();
      redLight.off();
      return Response.json({ message: "Green light toggled" });
    },
    "/music.mp3": () => {
      return new Response(
        Bun.file(`${import.meta.dir}/music-free-458044.mp3`),
        {
          headers: {
            "Content-Type": "audio/mpeg",
          },
        }
      );
    },
  },
});
