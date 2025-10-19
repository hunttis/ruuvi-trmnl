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
  private isRunning = false;
  private readonly refreshInterval: number;
  private lastSentTime: number = 0;
  private readonly minSendInterval: number = 5 * 60 * 1000;
  private startTime: Date = new Date();
  private readonly useConsoleDisplay: boolean;

  constructor(useConsoleDisplay: boolean = true) {
    this.ruuviCollector = new RuuviCollector();
    this.trmnlSender = new TrmnlWebhookSender();
    this.consoleDisplay = new ConsoleDisplay();
    this.useConsoleDisplay = useConsoleDisplay;

    if (useConsoleDisplay) {
      Logger.setSuppressConsole(true);
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

    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("🔍 Starting RuuviTag scanning...");
    } else {
      console.log("🔍 Starting RuuviTag scanning...");
    }
    await this.ruuviCollector.startScanning();

    await this.delay(3000);
    await this.sendDataCycle();
    this.intervalId = setInterval(() => {
      this.sendDataCycle().catch((error) => {
        if (this.useConsoleDisplay) {
          this.updateConsoleDisplay(
            `❌ Error in periodic data cycle: ${
              error instanceof Error ? error.message : error
            }`,
            true
          );
        } else {
          console.error(
            "❌ Error in periodic data cycle:",
            error instanceof Error ? error.message : error
          );
        }
      });
    }, this.refreshInterval);

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
      tags,
    };

    if (this.lastSentTime > 0) {
      status.lastSentTime = new Date(this.lastSentTime);
      status.nextSendTime = new Date(this.lastSentTime + this.minSendInterval);
    }

    if (isError && message) {
      status.lastError = message;
    }

    this.consoleDisplay.updateStatus(status);
  }

  private async sendDataCycle(): Promise<void> {
    try {
      const hasChanges = this.ruuviCollector.hasChangedConfiguredTags();

      if (!hasChanges) {
        this.updateConsoleDisplay();
        return;
      }

      const now = Date.now();
      const timeSinceLastSend = now - this.lastSentTime;

      if (this.lastSentTime > 0 && timeSinceLastSend < this.minSendInterval) {
        this.updateConsoleDisplay();
        return;
      }

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
              lastUpdated: new Date().toISOString(),
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

      const success = await this.trmnlSender.sendRuuviData(completeDataset);

      if (success) {
        this.lastSentTime = now;
        const existingTagIds = existingTags.map((tag) => tag.id);
        this.ruuviCollector.markTagsAsSent(existingTagIds);
      }

      this.updateConsoleDisplay();
    } catch (error) {
      this.updateConsoleDisplay(
        `Error in data cycle: ${
          error instanceof Error ? error.message : error
        }`,
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  } catch (error) {
    console.error(
      "💥 Failed to start application:",
      error instanceof Error ? error.message : error
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
