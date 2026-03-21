import { ExternalRuuviScanner } from "@/collectors/external-ruuvi-scanner";

const s = new ExternalRuuviScanner(undefined, undefined, "ruuvi-scanner.pid");

s.on("started", () => console.log("EVENT: started"));
s.on("error", (e: Error) => console.error("EVENT: error -", e.message));
s.on("exit", (code: number) => console.log("EVENT: exit -", code));

console.log("Starting detection...");
s.start();

setTimeout(() => {
  console.log("Test script finished");
  process.exit(0);
}, 6000);
