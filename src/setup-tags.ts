#!/usr/bin/env node

import * as readline from "readline";
import * as fs from "fs";
import { configManager } from "./config";
import { RawRuuviTag, RawRuuviData } from "./types";

const ruuvi = require("node-ruuvitag");

interface DiscoveredTag {
  id: string;
  shortId: string;
  nickname?: string;
  lastSeen: Date;
  data?: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
    battery?: number;
    rssi?: number;
  };
}

class RuuviTagSetup {
  private discoveredTags = new Map<string, DiscoveredTag>();
  private rl: readline.Interface;
  private isScanning = false;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle Ctrl+C gracefully
    this.rl.on("SIGINT", () => {
      this.cleanup();
    });
  }

  public async start(): Promise<void> {
    console.log("\n🔍 RuuviTag Setup Tool");
    console.log("═════════════════════════");
    console.log(
      "This tool will help you discover RuuviTags and assign nicknames."
    );
    console.log("Press Ctrl+C at any time to save and exit.\n");

    this.setupRuuviListeners();
    await this.startScanning();
    await this.showMainMenu();
  }

  private setupRuuviListeners(): void {
    ruuvi.on("found", (tag: RawRuuviTag) => {
      const shortId = tag.id.substring(0, 8);

      if (!this.discoveredTags.has(tag.id)) {
        const discoveredTag: DiscoveredTag = {
          id: tag.id,
          shortId,
          lastSeen: new Date(),
        };

        this.discoveredTags.set(tag.id, discoveredTag);
        console.log(`\n📡 New tag discovered: ${shortId}`);
        this.refreshDisplay();
      }

      // Listen for data updates
      tag.on("updated", (data: RawRuuviData) => {
        const existing = this.discoveredTags.get(tag.id);
        if (existing) {
          existing.lastSeen = new Date();
          existing.data = {
            ...(data.temperature !== undefined && {
              temperature: data.temperature,
            }),
            ...(data.humidity !== undefined && { humidity: data.humidity }),
            ...(data.pressure !== undefined && {
              pressure: data.pressure / 100,
            }),
            ...(data.battery !== undefined && { battery: data.battery / 1000 }),
            ...(data.rssi !== undefined && { rssi: data.rssi }),
          };
        }
      });
    });

    ruuvi.on("warning", (message: string) => {
      console.log(`⚠️  ${message}`);
    });
  }

  private async startScanning(): Promise<void> {
    console.log("🔍 Starting RuuviTag scan...");
    this.isScanning = true;
    // The ruuvi library starts scanning automatically when listeners are set up
  }

  private refreshDisplay(): void {
    if (this.discoveredTags.size === 0) return;

    console.log("\n📋 Discovered Tags:");
    console.log("───────────────────");

    let index = 1;
    for (const [fullId, tag] of this.discoveredTags) {
      const nickname = tag.nickname || "<no nickname>";
      const temp = tag.data?.temperature?.toFixed(1) || "N/A";
      const humidity = tag.data?.humidity?.toFixed(0) || "N/A";
      const battery = tag.data?.battery?.toFixed(2) || "N/A";
      const lastSeen = tag.lastSeen.toLocaleTimeString();

      console.log(`${index}. ${tag.shortId} → ${nickname}`);
      console.log(
        `   📊 ${temp}°C, ${humidity}%, ${battery}V | Last: ${lastSeen}`
      );
      index++;
    }
  }

  private async showMainMenu(): Promise<void> {
    while (true) {
      this.refreshDisplay();

      console.log("\n🛠️  Actions:");
      console.log("1-9) Set nickname for tag number");
      console.log("s) Save to config.json");
      console.log("r) Refresh display");
      console.log("q) Quit");

      const choice = await this.askQuestion("\nChoose an action: ");

      if (choice.toLowerCase() === "q") {
        await this.saveAndExit();
        break;
      } else if (choice.toLowerCase() === "s") {
        await this.saveToConfig();
      } else if (choice.toLowerCase() === "r") {
        // Just refresh by continuing the loop
        continue;
      } else if (/^[1-9]$/.test(choice)) {
        const tagIndex = parseInt(choice) - 1;
        await this.setNickname(tagIndex);
      } else {
        console.log("❌ Invalid choice. Try again.");
      }
    }
  }

  private async setNickname(index: number): Promise<void> {
    const tags = Array.from(this.discoveredTags.values());

    if (index >= tags.length) {
      console.log("❌ Invalid tag number.");
      return;
    }

    const tag = tags[index];
    if (!tag) {
      console.log("❌ Tag not found.");
      return;
    }

    const currentNickname = tag.nickname || "<no nickname>";

    console.log(`\n📝 Setting nickname for ${tag.shortId}`);
    console.log(`Current nickname: ${currentNickname}`);

    const nickname = await this.askQuestion(
      "Enter new nickname (or press Enter to skip): "
    );

    if (nickname.trim()) {
      tag.nickname = nickname.trim();
      console.log(`✅ Set nickname "${nickname.trim()}" for ${tag.shortId}`);
    } else {
      console.log("ℹ️  Nickname unchanged.");
    }
  }

  private async saveToConfig(): Promise<void> {
    try {
      // Load current config
      const currentConfig = configManager.getConfig();

      // Update tagAliases with discovered nicknames
      const tagAliases: Record<string, string> = {
        ...currentConfig.ruuvi.tagAliases,
      };

      let addedCount = 0;
      let updatedCount = 0;

      for (const tag of this.discoveredTags.values()) {
        if (tag.nickname) {
          const wasExisting = tagAliases.hasOwnProperty(tag.shortId);
          tagAliases[tag.shortId] = tag.nickname;

          if (wasExisting) {
            updatedCount++;
          } else {
            addedCount++;
          }
        }
      }

      // Create updated config
      const updatedConfig = {
        ...currentConfig,
        ruuvi: {
          ...currentConfig.ruuvi,
          tagAliases,
        },
      };

      // Write to file
      const configPath = "config.json";
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(updatedConfig, null, 2)
      );

      console.log(`\n✅ Config saved to ${configPath}`);
      console.log(`   📝 Added: ${addedCount} new tags`);
      console.log(`   🔄 Updated: ${updatedCount} existing tags`);

      // Show current tagAliases
      console.log("\n📋 Current tagAliases:");
      for (const [id, alias] of Object.entries(tagAliases)) {
        console.log(`   ${id} → ${alias}`);
      }
    } catch (error) {
      console.error("❌ Error saving config:", error);
    }
  }

  private async saveAndExit(): Promise<void> {
    console.log("\n💾 Saving configuration before exit...");
    await this.saveToConfig();
    this.cleanup();
  }

  private cleanup(): void {
    console.log("\n🛑 Stopping scan and cleaning up...");
    this.rl.close();
    process.exit(0);
  }

  private askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}

// CLI functionality
async function main() {
  try {
    const setup = new RuuviTagSetup();
    await setup.start();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("🔍 RuuviTag Setup Tool");
  console.log("");
  console.log("Usage: npm run setup");
  console.log("");
  console.log("Interactive tool to:");
  console.log("• Discover nearby RuuviTag sensors");
  console.log("• Assign friendly nicknames to each sensor");
  console.log("• Automatically update config.json with tagAliases");
  console.log("");
  console.log(
    "The tool will scan for RuuviTags and show real-time sensor data."
  );
  console.log(
    "Use the interactive menu to assign nicknames and save to config."
  );
  process.exit(0);
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
