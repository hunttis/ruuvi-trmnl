#!/usr/bin/env node

import * as readline from "readline";
import * as fs from "fs";
import { configManager } from "@/lib/config";
import { RawRuuviTag, RawRuuviData } from "@/lib/types";
import { InkSetupDisplay } from "@/ui/ink-setup-display";
import { green, red } from "@/lib/colors";
import { CacheManager } from "@/cache/cache-manager";

const ruuvi = require("node-ruuvitag");

export interface DiscoveredTag {
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
  private display: InkSetupDisplay;
  private isScanning = false;
  private startTime = new Date();
  private rl: readline.Interface;
  private cacheManager: CacheManager;

  constructor() {
    this.display = new InkSetupDisplay();
    this.cacheManager = new CacheManager();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.display.setKeyPressCallback((key: string) => {
      this.handleKeyPress(key);
    });
  }

  public async start(): Promise<void> {
    this.startTime = new Date();
    await this.display.start();

    // Initialize cache manager to load existing data
    await this.cacheManager.initialize();

    this.updateDisplay("Starting RuuviTag discovery...");

    this.setupRuuviListeners();
    await this.startScanning();

    // Keep the process running
    return new Promise((resolve) => {
      // The process will exit via keyboard handlers
    });
  }

  private setupRuuviListeners(): void {
    ruuvi.on("found", (tag: RawRuuviTag) => {
      const shortId = tag.id.substring(0, 8);

      if (!this.discoveredTags.has(tag.id)) {
        // Check if this tag already has a nickname in config
        let existingNickname: string | undefined;
        try {
          const currentConfig = configManager.getConfig();
          existingNickname = currentConfig.ruuvi.tagAliases[shortId];
        } catch (error) {
          // Config file might not exist yet, that's ok
        }

        const discoveredTag: DiscoveredTag = {
          id: tag.id,
          shortId,
          lastSeen: new Date(),
          ...(existingNickname && { nickname: existingNickname }),
        };

        this.discoveredTags.set(tag.id, discoveredTag);
        const displayMessage = existingNickname
          ? `Found tag: ${shortId} (${existingNickname})`
          : `New tag discovered: ${shortId}`;
        this.updateDisplay(displayMessage);
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
          this.updateDisplay();
        }
      });
    });

    ruuvi.on("warning", (message: string) => {
      this.updateDisplay(`Warning: ${message}`);
    });
  }

  private async startScanning(): Promise<void> {
    this.isScanning = true;
    this.updateDisplay("RuuviTag scan started");
    // The ruuvi library starts scanning automatically when listeners are set up
  }

  private updateDisplay(currentAction?: string): void {
    // Get configured tags from cache
    const configuredTags = this.getConfiguredTags();

    const status: any = {
      isScanning: this.isScanning,
      startTime: this.startTime,
      discoveredTags: this.discoveredTags,
      configuredTags,
    };

    if (currentAction) {
      status.currentAction = currentAction;
    }

    this.display.updateStatus(status);
  }

  private getConfiguredTags(): Array<{
    id: string;
    name: string;
    lastSeen?: Date;
  }> {
    const tags: Array<{ id: string; name: string; lastSeen?: Date }> = [];

    try {
      const config = configManager.getConfig();
      const cachedData = this.cacheManager.getAllCachedTags();

      // Go through all tags in config
      for (const [shortId, nickname] of Object.entries(
        config.ruuvi.tagAliases
      )) {
        const cached = cachedData.find((c: any) => c.id === shortId);

        if (cached?.lastUpdated) {
          tags.push({
            id: shortId,
            name: nickname,
            lastSeen: new Date(cached.lastUpdated),
          });
        } else {
          tags.push({
            id: shortId,
            name: nickname,
          });
        }
      }
    } catch (error) {
      // Config or cache might not exist yet
    }

    return tags;
  }

  private handleKeyPress(key: string): void {
    const keyLower = key.toLowerCase();

    if (keyLower === "q") {
      this.saveAndExit();
    } else if (keyLower === "s") {
      this.saveToConfig();
    } else if (keyLower === "r") {
      this.updateDisplay("Display refreshed");
    } else if (/^[1-9]$/.test(key)) {
      const tagIndex = parseInt(key) - 1;
      this.setNickname(tagIndex);
    }
  }

  private async setNickname(index: number): Promise<void> {
    const tags = Array.from(this.discoveredTags.values());

    if (index >= tags.length) {
      this.updateDisplay("Invalid tag number");
      return;
    }

    const tag = tags[index];
    if (!tag) {
      this.updateDisplay("Tag not found");
      return;
    }

    this.updateDisplay(`Setting nickname for ${tag.shortId}...`);

    // Temporarily restore terminal to get input
    this.display.stop();

    const currentNickname = tag.nickname || "<no nickname>";
    console.log(`\n📝 Setting nickname for ${tag.shortId}`);
    console.log(`Current nickname: ${currentNickname}`);

    const nickname = await this.askQuestion(
      "Enter new nickname (or press Enter to skip): "
    );

    if (nickname.trim()) {
      tag.nickname = nickname.trim();
      this.updateDisplay(
        `Set nickname "${nickname.trim()}" for ${tag.shortId}`
      );
    } else {
      this.updateDisplay("Nickname unchanged");
    }

    // Restart display
    this.display.start();
  }

  private async saveToConfig(): Promise<void> {
    try {
      this.updateDisplay("Saving configuration...");

      // Load current config
      const currentConfig = configManager.getConfig();

      // Update tagAliases with discovered nicknames
      const tagAliases: Record<string, string> = {
        ...currentConfig.ruuvi.tagAliases,
      };

      let addedCount = 0;
      let updatedCount = 0;
      const newTagIds: string[] = [];

      for (const tag of this.discoveredTags.values()) {
        if (tag.nickname) {
          const wasExisting = tagAliases.hasOwnProperty(tag.shortId);
          tagAliases[tag.shortId] = tag.nickname;

          if (wasExisting) {
            updatedCount++;
          } else {
            addedCount++;
            newTagIds.push(tag.shortId);
          }
        }
      }

      // Update displayOrder to include new tags
      const currentDisplayOrder = currentConfig.ruuvi.displayOrder || [];
      const existingTagIds = new Set(currentDisplayOrder);
      const updatedDisplayOrder = [...currentDisplayOrder];

      // Add new tags to the end of the display order
      for (const tagId of newTagIds) {
        if (!existingTagIds.has(tagId)) {
          updatedDisplayOrder.push(tagId);
        }
      }

      // Create updated config
      const updatedConfig = {
        ...currentConfig,
        ruuvi: {
          ...currentConfig.ruuvi,
          tagAliases,
          displayOrder: updatedDisplayOrder,
        },
      };

      // Write to file
      const configPath = "config.json";
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(updatedConfig, null, 2)
      );

      const totalSaved = addedCount + updatedCount;
      this.updateDisplay(`Saved ${totalSaved} tags to config.json`);

      // Update display with saved count
      this.display.updateStatus({ savedCount: totalSaved });
    } catch (error: any) {
      const errorMsg = error?.message ?? "Unknown error";
      this.updateDisplay(`Error saving config: ${errorMsg}`);
    }
  }

  private async saveAndExit(): Promise<void> {
    this.updateDisplay("Saving configuration before exit...");
    await this.saveToConfig();
    this.updateDisplay("Stopping scan and cleaning up...");
    this.display.stop();
    this.rl.close();
    console.log(green("\nSetup completed. Configuration saved to config.json"));
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
    console.error(red("Error:"), error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("RuuviTag Setup Tool");
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
