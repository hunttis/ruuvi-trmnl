import { configManager } from "@/lib/config";
import { RuuviCollector } from "@/collectors/ruuvi-collector";
import { TrmnlWebhookSender } from "@/trmnl/trmnl-sender";
import { RuuviTagData, RawRuuviTag, RawRuuviData } from "@/lib/types";
import { CombinedDisplay } from "@/ui/ink-combined-display";
import { Logger } from "@/lib/logger";
import { green, red, blue } from "@/lib/colors";
import { CacheManager } from "@/cache/cache-manager";
import * as fs from "fs";

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

export class RuuviTrmnlApp {
  private ruuviCollector: RuuviCollector;
  private trmnlSender: TrmnlWebhookSender;
  private consoleDisplay: CombinedDisplay;
  private intervalId: NodeJS.Timeout | null = null;
  private displayUpdateIntervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly refreshInterval: number;
  private lastSentTime: number = 0;
  private readonly minSendInterval: number = 10 * 60 * 1000; // 10 minutes
  private startTime: Date = new Date();
  private readonly useConsoleDisplay: boolean;
  private lastResponseCode: number | undefined;
  private lastResponseMessage: string | undefined;
  private lastSentData: any = null;
  private rateLimitedUntil: number = 0;
  private readonly rateLimitCooldown: number = 10 * 60 * 1000; // 10 minutes
  private readonly manualMode: boolean;
  
  // Setup mode properties
  private setupCacheManager: CacheManager;
  private discoveredTags = new Map<string, DiscoveredTag>();
  private setupStartTime = new Date();
  private isSetupScanning = false;

  constructor(useConsoleDisplay: boolean = true, manualMode: boolean = false) {
    this.ruuviCollector = new RuuviCollector();
    this.trmnlSender = new TrmnlWebhookSender();
    this.consoleDisplay = new CombinedDisplay();
    this.setupCacheManager = new CacheManager();
    this.useConsoleDisplay = useConsoleDisplay;
    this.manualMode = manualMode;

    if (useConsoleDisplay) {
      Logger.setSuppressConsole(true);
      this.consoleDisplay.setForceSendCallback(() => this.forceSendData());
      this.consoleDisplay.setSetupKeyPressCallback((key: string) =>
        this.handleSetupKeyPress(key)
      );
      this.consoleDisplay.setScreenChangeCallback((screen: string) =>
        this.handleScreenChange(screen as "dashboard" | "setup")
      );
    }

    const config = configManager.getConfig();
    this.refreshInterval = config.trmnl.refreshInterval * 1000;
  }

  // Helper to format dates as yy-MM-dd hh:mm
  private formatDateTime(isoString: string): string {
    const date = new Date(isoString);
    const yy = date.getFullYear().toString().slice(-2);
    const MM = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${yy}-${MM}-${dd} ${hh}:${mm}`;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay("⚡ App is already running");
      } else {
        console.log("⚡ App is already running");
      }
      return;
    }

    this.startTime = new Date();

    if (this.useConsoleDisplay) {
      await this.consoleDisplay.start();
      this.updateConsoleDisplay("🚀 Starting RuuviTRMNL application...");
    } else {
      console.log("🚀 Starting RuuviTRMNL application...");
    }

    const connectionOk = await this.trmnlSender.testConnection();
    if (!connectionOk) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay(
          "⚡ TRMNL connection test failed. Will try sending data anyway.",
          true
        );
      } else {
        Logger.warn(
          "⚡ TRMNL connection test failed. Will try sending data anyway."
        );
      }
    }

    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("📁 Initializing cache system...");
    } else {
      console.log("📁 Initializing cache system...");
    }
    await this.ruuviCollector.initialize();

    // Load the most recent sent time from cache
    const cachedLastSentTime = this.ruuviCollector.getMostRecentSentTime();
    if (cachedLastSentTime > 0) {
      this.lastSentTime = cachedLastSentTime;
      const minutesSinceLastSend = Math.floor(
        (Date.now() - cachedLastSentTime) / (60 * 1000)
      );
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay(
          `📅 Last send was ${minutesSinceLastSend} minute(s) ago`
        );
      } else {
        console.log(`📅 Last send was ${minutesSinceLastSend} minute(s) ago`);
      }
    }

    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("Starting RuuviTag scanning...");
    } else {
      console.log(blue("Starting RuuviTag scanning..."));
    }
    await this.ruuviCollector.startScanning();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // In manual mode, don't send on startup or automatically
    if (!this.manualMode) {
      await this.sendDataCycle();
      this.intervalId = setInterval(() => {
        this.sendDataCycle().catch((error) => {
          const errorMsg = error?.message ?? String(error);
          if (this.useConsoleDisplay) {
            this.updateConsoleDisplay(
              `${red("Error in periodic data cycle:")} ${errorMsg}`,
              true
            );
          } else {
            console.error(red("Error in periodic data cycle:"), errorMsg);
          }
        });
      }, this.refreshInterval);
    } else {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay(
          "⌨  Manual mode: Press SPACE to send data to TRMNL"
        );
      }
    }

    // Update display every 2 seconds to show live tag data
    if (this.useConsoleDisplay) {
      this.displayUpdateIntervalId = setInterval(() => {
        this.updateConsoleDisplay();
      }, 2000);
    }

    this.isRunning = true;

    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay(
        green("RuuviTRMNL application started successfully")
      );
    } else {
      console.log(green("RuuviTRMNL application started successfully"));
    }

    this.setupGracefulShutdown();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay("App is not running");
      } else {
        console.log("App is not running");
      }
      return;
    }

    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("🛑 Stopping RuuviTRMNL application...");
    } else {
      console.log("🛑 Stopping RuuviTRMNL application...");
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.displayUpdateIntervalId) {
      clearInterval(this.displayUpdateIntervalId);
      this.displayUpdateIntervalId = null;
    }

    await this.ruuviCollector.stopScanning();

    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("📁 Saving cache before shutdown...");
    } else {
      console.log("📁 Saving cache before shutdown...");
    }
    await this.ruuviCollector.saveCache();

    this.isRunning = false;
    if (this.useConsoleDisplay) {
      this.consoleDisplay.stop();
    }

    console.log(green("RuuviTRMNL application stopped"));
  }

  private updateConsoleDisplay(
    message?: string,
    isError: boolean = false
  ): void {
    const tags = this.ruuviCollector.getAllConfiguredTags();
    const collectorStats = this.ruuviCollector.getStats();
    const cacheStats = this.ruuviCollector.getCacheStats();
    const webhookInfo = this.trmnlSender.getWebhookInfo();

    const status = {
      isRunning: this.isRunning,
      startTime: this.startTime,
      lastUpdateTime: new Date(),
      collectorStats,
      cacheStats,
      webhookInfo,
      trmnlStats: {
        totalSent: this.trmnlSender.getTotalSent(),
        ...(this.lastResponseCode !== undefined && {
          lastResponseCode: this.lastResponseCode,
        }),
        ...(this.lastResponseMessage !== undefined && {
          lastResponseMessage: this.lastResponseMessage,
        }),
      },
      lastSentData: this.lastSentData,
      tags,
    };

    if (this.lastSentTime > 0) {
      (status as any).lastSentTime = new Date(this.lastSentTime);
      (status as any).nextSendTime = new Date(this.lastSentTime + this.minSendInterval);
    }

    // Add rate limiting status
    if (this.isRateLimited()) {
      (status as any).rateLimitedUntil = new Date(this.rateLimitedUntil);
      (status as any).rateLimitRemainingMinutes = this.getRateLimitRemainingTime();
    }

    if (isError && message) {
      (status as any).lastError = message;
    }

    this.consoleDisplay.updateDashboardStatus(status);
  }

  private async sendDataCycle(): Promise<void> {
    try {
      const now = Date.now();
      const timeSinceLastSend = now - this.lastSentTime;

      // Check if we're currently rate limited first
      if (this.isRateLimited()) {
        const remainingMinutes = Math.ceil(this.getRateLimitRemainingTime());
        this.updateConsoleDisplay(
          red(`Rate limited - ${remainingMinutes}m remaining`)
        );
        return;
      }

      // Simple rule: Only send if 10 minutes have passed since last send
      // (or if this is the first send)
      if (this.lastSentTime > 0 && timeSinceLastSend < this.minSendInterval) {
        this.updateConsoleDisplay();
        return;
      }

      // If 10+ minutes have passed (or first send), proceed with sending

      const config = configManager.getConfig();
      const allConfiguredTagIds = configManager.getOrderedTagIds();
      const existingTags = this.ruuviCollector.getAllConfiguredTags();

      const existingDataMap = new Map<string, RuuviTagData>();
      existingTags.forEach((tag) => {
        existingDataMap.set(tag.id, tag);
      });

      const completeDataset: RuuviTagData[] = [];

      for (const shortId of allConfiguredTagIds) {
        const aliasName = config.ruuvi.tagAliases[shortId] || `Tag ${shortId}`;

        if (existingDataMap.has(shortId)) {
          const existingTag = existingDataMap.get(shortId)!;
          const maxAge = config.ruuvi.dataRetentionTime;
          const age = now - new Date(existingTag.lastUpdated).getTime();

          if (age > maxAge) {
            // Tag is stale, but keep all data including temperature/humidity
            completeDataset.push({
              ...existingTag,
              status: "stale",
            });
          } else {
            completeDataset.push(existingTag);
          }
        } else {
          completeDataset.push({
            id: shortId,
            name: aliasName,
            lastUpdated: new Date().toISOString(),
            status: "offline",
          });
        }
      }

      // Filter data to only include template-required fields
      const filteredDataset = this.filterTagDataForTemplate(completeDataset);

      // Format the filtered dataset for display
      const formattedDataset = filteredDataset.map((tag) => ({
        ...tag,
        lastUpdated: this.formatDateTime(tag.lastUpdated),
        ...(tag.lastTemperatureUpdate && {
          lastTemperatureUpdate: this.formatDateTime(tag.lastTemperatureUpdate),
        }),
      }));

      // Store the data that will be sent for display
      this.lastSentData = {
        merge_variables: {
          ruuvi_tags: formattedDataset,
          lastRefresh: this.formatDateTime(new Date().toISOString()),
          totalTags: formattedDataset.length,
        },
      };

      const response = await this.trmnlSender.sendRuuviData(completeDataset);

      this.lastResponseCode = response.statusCode;
      this.lastResponseMessage =
        response.message || response.error || undefined;

      // Check for rate limiting and set cooldown period
      if (response.statusCode === 429) {
        this.rateLimitedUntil = Date.now() + this.rateLimitCooldown;
        this.updateConsoleDisplay("Rate limited! Pausing sends for 10 minutes");
      }

      if (response.success) {
        this.lastSentTime = now;
        const existingTagIds = existingTags.map((tag) => tag.id);
        this.ruuviCollector.markTagsAsSent(existingTagIds);
      }

      this.updateConsoleDisplay();
    } catch (error: any) {
      this.updateConsoleDisplay(
        `Error in data cycle: ${error?.message ?? String(error)}`,
        true
      );
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      await this.stop();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      console.error("💥 Uncaught exception:", error);
      this.stop().finally(() => process.exit(1));
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("💥 Unhandled rejection at:", promise, "reason:", reason);
      this.stop().finally(() => process.exit(1));
    });
  }

  private filterTagDataForTemplate(tags: RuuviTagData[]): any[] {
    return tags.map((tag) => ({
      name: tag.name,
      temperature:
        tag.temperature !== undefined
          ? Number(tag.temperature.toFixed(1))
          : undefined,
      humidity: tag.humidity,
      lastUpdated: tag.lastUpdated,
      ...(tag.lastTemperatureUpdate && {
        lastTemperatureUpdate: tag.lastTemperatureUpdate,
      }),
    }));
  }

  public isRateLimited(): boolean {
    return Date.now() < this.rateLimitedUntil;
  }

  public getRateLimitRemainingTime(): number {
    const remainingMs = Math.max(0, this.rateLimitedUntil - Date.now());
    return remainingMs / (60 * 1000); // Convert to minutes
  }

  private async forceSendData(): Promise<void> {
    try {
      const now = Date.now();

      // Check if we're currently rate limited - this blocks even force sends
      if (this.isRateLimited()) {
        const remainingMinutes = Math.ceil(this.getRateLimitRemainingTime());
        this.updateConsoleDisplay(
          `Rate limited - cannot send for ${remainingMinutes}m`
        );
        return;
      }

      const timeSinceLastSend = now - this.lastSentTime;

      // Show warning if sending too frequently, but still allow the force send
      if (this.lastSentTime > 0 && timeSinceLastSend < this.minSendInterval) {
        const remainingTime = Math.ceil(
          (this.minSendInterval - timeSinceLastSend) / 1000
        );
        this.updateConsoleDisplay(
          `⚡ Force sending (recommended wait: ${remainingTime}s)`
        );
      } else {
        this.updateConsoleDisplay("🚀 Force sending data to TRMNL...");
      }

      // Force send ignores data changes and time interval
      const config = configManager.getConfig();
      const allConfiguredTagIds = configManager.getOrderedTagIds();
      const existingTags = this.ruuviCollector.getAllConfiguredTags();

      const existingDataMap = new Map<string, RuuviTagData>();
      existingTags.forEach((tag) => {
        existingDataMap.set(tag.id, tag);
      });

      const completeDataset: RuuviTagData[] = [];

      for (const shortId of allConfiguredTagIds) {
        const aliasName = config.ruuvi.tagAliases[shortId] || `Tag ${shortId}`;

        if (existingDataMap.has(shortId)) {
          const existingTag = existingDataMap.get(shortId)!;
          const maxAge = config.ruuvi.dataRetentionTime;
          const age = now - new Date(existingTag.lastUpdated).getTime();

          if (age > maxAge) {
            // Tag is stale, but keep all data including temperature/humidity
            completeDataset.push({
              ...existingTag,
              status: "stale",
            });
          } else {
            completeDataset.push(existingTag);
          }
        } else {
          completeDataset.push({
            id: shortId,
            name: aliasName,
            lastUpdated: new Date().toISOString(),
            status: "offline",
          });
        }
      }

      // Filter data to only include template-required fields
      const filteredDataset = this.filterTagDataForTemplate(completeDataset);

      // Format the filtered dataset for display
      const formattedDataset = filteredDataset.map((tag) => ({
        ...tag,
        lastUpdated: this.formatDateTime(tag.lastUpdated),
        ...(tag.lastTemperatureUpdate && {
          lastTemperatureUpdate: this.formatDateTime(tag.lastTemperatureUpdate),
        }),
      }));

      // Store the data that will be sent for display
      this.lastSentData = {
        merge_variables: {
          ruuvi_tags: formattedDataset,
          lastRefresh: this.formatDateTime(new Date().toISOString()),
          totalTags: formattedDataset.length,
        },
      };

      const response = await this.trmnlSender.sendRuuviData(completeDataset);

      this.lastResponseCode = response.statusCode;
      this.lastResponseMessage =
        response.message || response.error || undefined;

      // Check for rate limiting and set cooldown period
      if (response.statusCode === 429) {
        this.rateLimitedUntil = Date.now() + this.rateLimitCooldown;
        this.updateConsoleDisplay("Rate limited! Pausing sends for 10 minutes");
      }

      if (response.success) {
        this.lastSentTime = now;
        const existingTagIds = existingTags.map((tag) => tag.id);
        this.ruuviCollector.markTagsAsSent(existingTagIds);
      }

      this.updateConsoleDisplay();
    } catch (error: any) {
      this.updateConsoleDisplay(
        `Error in force send: ${error?.message ?? String(error)}`,
        true
      );
    }
  }

  public getStatus(): { running: boolean; stats: any; webhookInfo: any } {
    return {
      running: this.isRunning,
      stats: this.ruuviCollector.getStats(),
      webhookInfo: this.trmnlSender.getWebhookInfo(),
    };
  }

  // Setup mode methods
  private async handleScreenChange(screen: "dashboard" | "setup"): Promise<void> {
    if (screen === "setup") {
      await this.initializeSetupMode();
      this.updateSetupDisplay("Entering setup mode...");
    }
  }

  private async initializeSetupMode(): Promise<void> {
    if (this.isSetupScanning) {
      return;
    }

    this.setupStartTime = new Date();
    await this.setupCacheManager.initialize();
    this.discoveredTags.clear();

    // Setup ruuvi listeners for setup mode
    ruuvi.on("found", (tag: RawRuuviTag) => {
      this.handleSetupTagFound(tag);
    });

    this.isSetupScanning = true;
    await this.startSetupScanning();
  }

  private handleSetupTagFound(tag: RawRuuviTag): void {
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
      this.updateSetupDisplay(`Found tag: ${shortId}${existingNickname ? ` (${existingNickname})` : ""}`);
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
        this.updateSetupDisplay();
      }
    });
  }

  private async startSetupScanning(): Promise<void> {
    try {
      ruuvi.findTags();
      this.updateSetupDisplay("Setup scanning started");
    } catch (error: any) {
      this.updateSetupDisplay(`Failed to start setup scanning: ${error?.message ?? String(error)}`);
    }
  }

  private updateSetupDisplay(currentAction?: string): void {
    // Get configured tags from cache
    const configuredTags = this.getConfiguredTags();

    const status = {
      isScanning: this.isSetupScanning,
      startTime: this.setupStartTime,
      discoveredTags: this.discoveredTags,
      configuredTags,
    };

    if (currentAction) {
      (status as any).currentAction = currentAction;
    }

    this.consoleDisplay.updateSetupStatus(status);
  }

  private getConfiguredTags(): Array<{ id: string; name: string; lastSeen?: Date }> {
    const tags: Array<{ id: string; name: string; lastSeen?: Date }> = [];

    try {
      const config = configManager.getConfig();
      const cachedData = this.setupCacheManager.getAllCachedTags();

      // Go through all tags in config
      for (const [shortId, nickname] of Object.entries(config.ruuvi.tagAliases)) {
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

  private async handleSetupKeyPress(key: string): Promise<void> {
    const keyLower = key.toLowerCase();

    if (keyLower === "s") {
      await this.saveSetupConfig();
    } else if (keyLower === "r") {
      this.updateSetupDisplay("Display refreshed");
    } else if (/^[1-9]$/.test(key)) {
      const index = parseInt(key) - 1;
      const tagArray = Array.from(this.discoveredTags.values());

      if (index < tagArray.length && tagArray[index]) {
        await this.promptSetupNickname(tagArray[index]);
      }
    }
  }

  private async promptSetupNickname(tag: DiscoveredTag): Promise<void> {
    this.updateSetupDisplay(`Enter nickname for ${tag.shortId}: `);
    
    // Note: In the combined UI, we would need to implement a proper input mechanism
    // For now, this is a placeholder - we might need to enhance the UI to support text input
    // or continue using the numbered selection approach
  }

  private async saveSetupConfig(): Promise<void> {
    try {
      const config = configManager.getConfig();
      const tagArray = Array.from(this.discoveredTags.values());

      // Update aliases
      for (const tag of tagArray) {
        if (tag.nickname) {
          config.ruuvi.tagAliases[tag.shortId] = tag.nickname;
        }
      }

      // Update display order
      config.ruuvi.displayOrder = tagArray
        .filter((tag) => tag.nickname)
        .map((tag) => tag.shortId);

      // Save to file
      const configPath = "./config.json";
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      this.updateSetupDisplay(`Configuration saved! ${tagArray.filter(t => t.nickname).length} tags configured`);
    } catch (error: any) {
      this.updateSetupDisplay(`Failed to save configuration: ${error?.message ?? String(error)}`);
    }
  }
}

async function main(): Promise<void> {
  try {
    const config = configManager.getConfig();

    if (!configManager.getTrmnlWebhookUrl()) {
      throw new Error(
        "TRMNL webhook URL not configured. Please check config.json"
      );
    }

    const app = new RuuviTrmnlApp();
    await app.start();
  } catch (error: any) {
    console.error(
      "💥 Failed to start application:",
      error?.message ?? String(error)
    );
    process.exit(1);
  }
}
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}
