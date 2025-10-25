#!/usr/bin/env node

import { RuuviTrmnlApp } from "./app";
import { Logger } from "./logger";

async function main() {
  Logger.log("🚀 Starting RuuviTRMNL in Manual Mode");
  Logger.log("⌨️  Press SPACE to send data to TRMNL");
  Logger.log("⌨️  Press Q to quit\n");

  const app = new RuuviTrmnlApp(true, true);

  try {
    await app.start();
  } catch (error: any) {
    Logger.log(
      `❌ Failed to start application: ${error?.message ?? String(error)}`
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
