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
  private readonly minSendInterval: number = 5 * 60 * 1000; // 5 minutes in milliseconds
  private startTime: Date = new Date();
  private readonly useConsoleDisplay: boolean;

  constructor(useConsoleDisplay: boolean = true) {
    this.ruuviCollector = new RuuviCollector();
    this.trmnlSender = new TrmnlWebhookSender();
    this.consoleDisplay = new ConsoleDisplay();
    this.useConsoleDisplay = useConsoleDisplay;

    // Suppress console output when using dashboard display
    if (useConsoleDisplay) {
      Logger.setSuppressConsole(true);
    }

    const config = configManager.getConfig();
    this.refreshInterval = config.trmnl.refreshInterval * 1000; // Convert seconds to milliseconds
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

    // Start the console display if enabled
    if (this.useConsoleDisplay) {
      this.consoleDisplay.start();
      this.updateConsoleDisplay("🚀 Starting RuuviTRMNL application...");
    } else {
      console.log("🚀 Starting RuuviTRMNL application...");
    }

    // Test TRMNL connection first
    const connectionOk = await this.trmnlSender.testConnection();
    if (!connectionOk) {
      if (this.useConsoleDisplay) {
        this.updateConsoleDisplay(
          "❌ TRMNL connection test failed. Please check your webhook URL.",
          true
        );
      } else {
        console.error(
          "❌ TRMNL connection test failed. Please check your webhook URL."
        );
      }
      return;
    }

    // Initialize cache system first
    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("📁 Initializing cache system...");
    } else {
      console.log("📁 Initializing cache system...");
    }
    await this.ruuviCollector.initialize();

    // Start RuuviTag scanning
    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("🔍 Starting RuuviTag scanning...");
    } else {
      console.log("🔍 Starting RuuviTag scanning...");
    }
    await this.ruuviCollector.startScanning();

    // Give it a moment to discover initial tags
    await this.delay(3000);

    // Send initial data (if any changes exist)
    await this.sendDataCycle();

    // Set up periodic sending
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

    // Set up graceful shutdown
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

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop scanning
    await this.ruuviCollector.stopScanning();

    // Save cache before shutting down
    if (this.useConsoleDisplay) {
      this.updateConsoleDisplay("📁 Saving cache before shutdown...");
    } else {
      console.log("📁 Saving cache before shutdown...");
    }
    await this.ruuviCollector.saveCache();

    this.isRunning = false;

    // Stop console display if enabled
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
      // Check if any configured tags have changed
      const hasChanges = this.ruuviCollector.hasChangedConfiguredTags();

      if (!hasChanges) {
        this.updateConsoleDisplay();
        return;
      }

      // Check rate limiting (5 minutes between sends)
      const now = Date.now();
      const timeSinceLastSend = now - this.lastSentTime;

      if (this.lastSentTime > 0 && timeSinceLastSend < this.minSendInterval) {
        this.updateConsoleDisplay();
        return;
      }

      // Create complete dataset with all configured sensors
      const config = configManager.getConfig();
      const allConfiguredTagIds = configManager.getOrderedTagIds();
      const existingTags = this.ruuviCollector.getAllConfiguredTags();

      // Create map of existing data by short ID
      const existingDataMap = new Map<string, RuuviTagData>();
      existingTags.forEach((tag) => {
        existingDataMap.set(tag.id, tag);
      });

      // Build complete dataset including placeholders for missing sensors
      const completeDataset: RuuviTagData[] = [];

      for (const shortId of allConfiguredTagIds) {
        const aliasName = config.ruuvi.tagAliases[shortId] || `Tag ${shortId}`;

        if (existingDataMap.has(shortId)) {
          // Use existing data
          const existingTag = existingDataMap.get(shortId)!;

          // Check if data is too stale
          const maxAge = config.ruuvi.dataRetentionTime;
          const age = now - new Date(existingTag.lastUpdated).getTime();

          if (age > maxAge) {
            // Data is stale, create placeholder
            completeDataset.push({
              id: shortId,
              name: aliasName,
              lastUpdated: new Date().toISOString(),
              status: "stale",
              // temperature and humidity omitted - will show as "-" in template
            });
          } else {
            // Use fresh data
            completeDataset.push(existingTag);
          }
        } else {
          // No data exists, create placeholder
          completeDataset.push({
            id: shortId,
            name: aliasName,
            lastUpdated: new Date().toISOString(),
            status: "offline",
            // temperature and humidity omitted - will show as "-" in template
          });
        }
      }

      // Send to TRMNL
      const success = await this.trmnlSender.sendRuuviData(completeDataset);

      if (success) {
        this.lastSentTime = now; // Update last sent time

        // Mark all existing tags as sent in cache (not placeholders)
        const existingTagIds = existingTags.map((tag) => tag.id);
        this.ruuviCollector.markTagsAsSent(existingTagIds);
      }

      // Update display with latest status
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

    // Handle uncaught exceptions
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

// Main execution
async function main(): Promise<void> {
  try {
    // Validate configuration
    const config = configManager.getConfig();

    if (!configManager.getTrmnlWebhookUrl()) {
      throw new Error(
        "TRMNL webhook URL not configured. Please check config.json"
      );
    }

    // Create and start the application
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

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}
