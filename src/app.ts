import { configManager } from "./config";
import { RuuviCollector } from "./ruuvi-collector";
import { TrmnlWebhookSender } from "./trmnl-sender";
import { RuuviTagData } from "./types";
import { ConsoleDisplay, AppStatus } from "./console-display";
import { Logger } from "./logger";

export class RuuviTrmnlApp {
  private ruuviCollector: RuuviCollector;
  private trmnlSender: TrmnlWebhookSender;
  private consoleDisplay: ConsoleDisplay;
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

  constructor(useConsoleDisplay: boolean = true, manualMode: boolean = false) {
    this.ruuviCollector = new RuuviCollector();
    this.trmnlSender = new TrmnlWebhookSender();
    this.consoleDisplay = new ConsoleDisplay();
    this.useConsoleDisplay = useConsoleDisplay;
    this.manualMode = manualMode;

    if (useConsoleDisplay) {
      Logger.setSuppressConsole(true);
      this.consoleDisplay.setForceSendCallback(() => this.forceSendData());
    }

    const config = configManager.getConfig();
    this.refreshInterval = config.trmnl.refreshInterval * 1000;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay("⚠️  App is already running");
      } else {
        console.log("⚠️  App is already running");
      }
      return;
    }

    this.startTime = new Date();

    if (this.useConsoleDisplay) {
      this.consoleDisplay.start();
      this.updateConsoleDisplay("🚀 Starting RuuviTRMNL application...");
    } else {
      console.log("🚀 Starting RuuviTRMNL application...");
    }

    const connectionOk = await this.trmnlSender.testConnection();
    if (!connectionOk) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay(
          "⚠️ TRMNL connection test failed. Will try sending data anyway.",
          true
        );
      } else {
        console.warn(
          "⚠️ TRMNL connection test failed. Will try sending data anyway."
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
      this.updateConsoleDisplay("🔍 Starting RuuviTag scanning...");
    } else {
      console.log("🔍 Starting RuuviTag scanning...");
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
              `❌ Error in periodic data cycle: ${errorMsg}`,
              true
            );
          } else {
            console.error("❌ Error in periodic data cycle:", errorMsg);
          }
        });
      }, this.refreshInterval);
    } else {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay(
          "⌨️  Manual mode: Press SPACE to send data to TRMNL"
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
        "✅ RuuviTRMNL application started successfully"
      );
    } else {
      console.log("✅ RuuviTRMNL application started successfully");
    }

    this.setupGracefulShutdown();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay("ℹ️  App is not running");
      } else {
        console.log("ℹ️  App is not running");
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

    console.log("✅ RuuviTRMNL application stopped");
  }

  private updateConsoleDisplay(
    message?: string,
    isError: boolean = false
  ): void {
    const tags = this.ruuviCollector.getAllConfiguredTags();
    const collectorStats = this.ruuviCollector.getStats();
    const cacheStats = this.ruuviCollector.getCacheStats();
    const webhookInfo = this.trmnlSender.getWebhookInfo();

    const status: Partial<AppStatus> = {
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
      status.lastSentTime = new Date(this.lastSentTime);
      status.nextSendTime = new Date(this.lastSentTime + this.minSendInterval);
    }

    // Add rate limiting status
    if (this.isRateLimited()) {
      status.rateLimitedUntil = new Date(this.rateLimitedUntil);
      status.rateLimitRemainingMinutes = this.getRateLimitRemainingTime();
    }

    if (isError && message) {
      status.lastError = message;
    }

    this.consoleDisplay.updateStatus(status);
  }

  private async sendDataCycle(): Promise<void> {
    try {
      const now = Date.now();
      const timeSinceLastSend = now - this.lastSentTime;

      Logger.log(`[DEBUG] sendDataCycle - lastSentTime: ${this.lastSentTime}, timeSinceLastSend: ${Math.floor(timeSinceLastSend / 1000)}s, minInterval: ${Math.floor(this.minSendInterval / 1000)}s`);

      // Check if we're currently rate limited first
      if (this.isRateLimited()) {
        const remainingMinutes = Math.ceil(this.getRateLimitRemainingTime());
        Logger.log(`[DEBUG] Rate limited - ${remainingMinutes} minutes remaining`);
        this.updateConsoleDisplay(
          `🚫 Rate limited - ${remainingMinutes}m remaining`
        );
        return;
      }

      const hasChanges = this.ruuviCollector.hasChangedConfiguredTags();
      Logger.log(`[DEBUG] hasChanges: ${hasChanges}`);

      // Don't send if: we have a lastSentTime, it's been less than 10 minutes, and there are no changes
      if (
        this.lastSentTime > 0 &&
        timeSinceLastSend < this.minSendInterval &&
        !hasChanges
      ) {
        Logger.log(`[DEBUG] Not sending: too soon and no changes`);
        this.updateConsoleDisplay();
        return;
      }

      // After 10 minutes, send even if no changes (unless first send with no changes)
      if (!hasChanges && this.lastSentTime === 0) {
        Logger.log(`[DEBUG] Not sending: first send with no changes`);
        this.updateConsoleDisplay();
        return;
      }

      Logger.log(`[DEBUG] Proceeding to send data`);

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
            completeDataset.push({
              id: shortId,
              name: aliasName,
              lastUpdated: existingTag.lastUpdated,
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

      // Store the data that will be sent for display
      this.lastSentData = {
        merge_variables: {
          ruuvi_tags: filteredDataset,
          lastRefresh: new Date().toISOString(),
          totalTags: filteredDataset.length,
        },
      };

      const response = await this.trmnlSender.sendRuuviData(completeDataset);

      this.lastResponseCode = response.statusCode;
      this.lastResponseMessage =
        response.message || response.error || undefined;

      // Check for rate limiting and set cooldown period
      if (response.statusCode === 429) {
        this.rateLimitedUntil = Date.now() + this.rateLimitCooldown;
        this.updateConsoleDisplay(
          "🚫 Rate limited! Pausing sends for 10 minutes"
        );
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
      temperature: tag.temperature,
      humidity: tag.humidity,
      status: tag.status,
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
          `🚫 Rate limited - cannot send for ${remainingMinutes}m`
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
          `⚠️ Force sending (recommended wait: ${remainingTime}s)`
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
            completeDataset.push({
              id: shortId,
              name: aliasName,
              lastUpdated: existingTag.lastUpdated,
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

      // Store the data that will be sent for display
      this.lastSentData = {
        merge_variables: {
          ruuvi_tags: filteredDataset,
          lastRefresh: new Date().toISOString(),
          totalTags: filteredDataset.length,
        },
      };

      const response = await this.trmnlSender.sendRuuviData(completeDataset);

      this.lastResponseCode = response.statusCode;
      this.lastResponseMessage =
        response.message || response.error || undefined;

      // Check for rate limiting and set cooldown period
      if (response.statusCode === 429) {
        this.rateLimitedUntil = Date.now() + this.rateLimitCooldown;
        this.updateConsoleDisplay(
          "🚫 Rate limited! Pausing sends for 10 minutes"
        );
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
