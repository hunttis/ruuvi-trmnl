#!/usr/bin/env node

import { RuuviCollector } from "./ruuvi-collector";
import { TrmnlWebhookSender } from "./trmnl-sender";
import { configManager } from "./config";
import { RuuviTagData } from "./types";

interface OneShotOptions {
  timeout?: number;
  verbose?: boolean;
}

export class TrmnlOneShot {
  private collector: RuuviCollector;
  private sender: TrmnlWebhookSender;
  private collectedTags = new Set<string>();
  private tagData = new Map<string, RuuviTagData>();
  private requiredTags: string[];
  private verbose: boolean;
  private isRunning = false;
  private checkIntervalId?: NodeJS.Timeout;

  constructor(options: OneShotOptions = {}) {
    this.collector = new RuuviCollector();
    this.sender = new TrmnlWebhookSender();
    this.verbose = options.verbose || false;

    // Get the list of tags we need to collect data for
    this.requiredTags = configManager.getOrderedTagIds();

    if (this.requiredTags.length === 0) {
      throw new Error(
        'No tags configured in config.json. Run "npm run setup" to configure tags first.'
      );
    }
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  private checkForNewTags(): void {
    if (!this.isRunning) return;

    // Get all active tag data from the collector
    const allTagData = this.collector.getActiveTagData();

    // Check for new tags that we haven't collected yet
    for (const tagData of allTagData) {
      const fullTagId = tagData.id;

      // Only collect data for configured tags
      if (!this.requiredTags.includes(fullTagId)) {
        continue;
      }

      // Skip if we already have data for this tag
      if (this.collectedTags.has(fullTagId)) {
        continue;
      }

      this.log(`✓ Collected data for tag: ${tagData.name} (${fullTagId})`);

      this.collectedTags.add(fullTagId);
      this.tagData.set(fullTagId, tagData);

      // Check if we have all required tags
      if (this.collectedTags.size === this.requiredTags.length) {
        this.log(
          `✓ All ${this.requiredTags.length} tags collected, sending to TRMNL...`
        );
        this.sendAndExit();
        return;
      }
    }
  }

  private async sendAndExit(): Promise<void> {
    this.isRunning = false;

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    try {
      // Convert collected data to array
      const dataToSend = Array.from(this.tagData.values());

      this.log(
        `📤 Sending ${dataToSend.length} tag records to TRMNL (temp & humidity only)...`
      );

      // Send to TRMNL using the same method as the main app (filtering is now done in TrmnlWebhookSender)
      const success = await this.sender.sendRuuviData(dataToSend);

      if (success) {
        console.log("✅ Successfully sent data to TRMNL!");
        console.log(
          `📊 Sent data for: ${dataToSend.map((t) => t.name).join(", ")}`
        );
        process.exit(0);
      } else {
        console.error("❌ Failed to send data to TRMNL");
        process.exit(1);
      }
    } catch (error) {
      console.error(
        "❌ Error sending to TRMNL:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  async run(timeoutMs: number = 30000): Promise<void> {
    console.log("🎯 TRMNL One-Shot Data Collection");
    console.log(
      `📡 Looking for ${this.requiredTags.length} configured tags...`
    );

    if (this.verbose) {
      const aliases = configManager.getConfig().ruuvi.tagAliases;
      console.log("📝 Required tags:");
      this.requiredTags.forEach((id) => {
        console.log(`  - ${aliases[id]} (${id})`);
      });
    }

    this.isRunning = true;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (this.isRunning) {
        console.log(`⏰ Timeout after ${timeoutMs / 1000}s`);
        console.log(
          `📊 Collected ${this.collectedTags.size}/${this.requiredTags.length} tags`
        );

        if (this.collectedTags.size > 0) {
          console.log("🔄 Sending partial data...");
          this.sendAndExit();
        } else {
          console.log("❌ No tag data collected");
          this.cleanup(1);
        }
      }
    }, timeoutMs);

    // Set up graceful shutdown
    const cleanup = () => {
      clearTimeout(timeoutId);
      this.cleanup(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    try {
      // Initialize the collector and cache system
      await this.collector.initialize();

      // Start RuuviTag scanning
      this.collector.startScanning();

      this.log("🎧 Listening for RuuviTag broadcasts...");

      // Check for new tags every 500ms
      this.checkIntervalId = setInterval(() => {
        this.checkForNewTags();
      }, 500);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(
        "❌ Error starting collector:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  private cleanup(exitCode: number): void {
    this.isRunning = false;

    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
    }

    try {
      this.collector.stopScanning();
    } catch (error) {
      console.error("Error stopping collector:", error);
    }

    process.exit(exitCode);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout="));
  const timeout = timeoutArg
    ? parseInt(timeoutArg.split("=")[1] || "30") * 1000
    : 30000;

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🎯 TRMNL One-Shot Data Collector

Usage: npm run trmnl:send [options]

Options:
  --verbose, -v      Show detailed logging
  --timeout=<sec>    Timeout in seconds (default: 30)
  --help, -h         Show this help

Description:
  Listens for RuuviTag broadcasts, collects one update from each 
  configured tag, sends the data to TRMNL, then exits.
  
  Tags must be configured first using: npm run setup
`);
    process.exit(0);
  }

  try {
    const oneShot = new TrmnlOneShot({ verbose });
    await oneShot.run(timeout);
  } catch (error) {
    console.error(
      "❌ Failed to start:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
