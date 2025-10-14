import { configManager } from "./config";
import { RuuviCollector } from "./ruuvi-collector";
import { TrmnlWebhookSender } from "./trmnl-sender";
import { RuuviTagData } from "./types";

export class RuuviTrmnlApp {
  private ruuviCollector: RuuviCollector;
  private trmnlSender: TrmnlWebhookSender;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly refreshInterval: number;

  constructor() {
    this.ruuviCollector = new RuuviCollector();
    this.trmnlSender = new TrmnlWebhookSender();

    const config = configManager.getConfig();
    this.refreshInterval = config.trmnl.refreshInterval * 1000; // Convert seconds to milliseconds
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️  App is already running");
      return;
    }

    console.log("🚀 Starting RuuviTRMNL application...");
    console.log(
      `📡 Refresh interval: ${this.refreshInterval / 1000}s (${Math.round(
        this.refreshInterval / 60000
      )} minutes)`
    );
    console.log(`🔗 TRMNL webhook: ${this.trmnlSender.getWebhookInfo().url}`);

    // Test TRMNL connection first
    const connectionOk = await this.trmnlSender.testConnection();
    if (!connectionOk) {
      console.error(
        "❌ TRMNL connection test failed. Please check your webhook URL."
      );
      return;
    }

    // Initialize cache system first
    console.log("📁 Initializing cache system...");
    await this.ruuviCollector.initialize();

    // Start RuuviTag scanning
    console.log("🔍 Starting RuuviTag scanning...");
    await this.ruuviCollector.startScanning();

    // Give it a moment to discover initial tags
    await this.delay(3000);

    // Send initial data (if any changes exist)
    await this.sendDataCycle();

    // Set up periodic sending
    this.intervalId = setInterval(() => {
      this.sendDataCycle().catch((error) => {
        console.error(
          "❌ Error in periodic data cycle:",
          error instanceof Error ? error.message : error
        );
      });
    }, this.refreshInterval);

    this.isRunning = true;
    console.log("✅ RuuviTRMNL application started successfully");

    // Set up graceful shutdown
    this.setupGracefulShutdown();
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("ℹ️  App is not running");
      return;
    }

    console.log("🛑 Stopping RuuviTRMNL application...");

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop scanning
    await this.ruuviCollector.stopScanning();

    // Save cache before shutting down
    console.log("📁 Saving cache before shutdown...");
    await this.ruuviCollector.saveCache();

    this.isRunning = false;
    console.log("✅ RuuviTRMNL application stopped");
  }

  private async sendDataCycle(): Promise<void> {
    try {
      // Get cache statistics
      const cacheStats = this.ruuviCollector.getCacheStats();
      const collectorStats = this.ruuviCollector.getStats();

      console.log(
        `\n📊 Data cycle - Total discovered: ${collectorStats.totalDiscovered}, ` +
          `Allowed tags: ${cacheStats.allowedTags}, Pending send: ${cacheStats.pendingSend}`
      );

      // Get only changed tags that are in tagAliases
      const changedTags = this.ruuviCollector.getChangedTagsForSending();

      if (changedTags.length === 0) {
        console.log(
          "ℹ️  No changed data for configured tags, skipping TRMNL update"
        );
        return;
      }

      // Filter out stale data if configured
      const config = configManager.getConfig();
      const maxAge = config.ruuvi.dataRetentionTime;
      const now = Date.now();

      const freshData = changedTags.filter((tag: RuuviTagData) => {
        const age = now - new Date(tag.lastUpdated).getTime();
        return age <= maxAge;
      });

      if (freshData.length === 0) {
        console.log(
          `⚠️  All changed data is stale (older than ${
            maxAge / 60000
          } minutes), skipping TRMNL update`
        );
        return;
      }

      if (freshData.length < changedTags.length) {
        console.log(
          `⚠️  Filtered out ${
            changedTags.length - freshData.length
          } stale readings`
        );
      }

      console.log(`📤 Sending ${freshData.length} changed readings to TRMNL`);

      // Send to TRMNL
      const success = await this.trmnlSender.sendRuuviData(freshData);

      if (success) {
        console.log(
          `✅ Successfully sent ${freshData.length} readings to TRMNL`
        );

        // Mark as sent in cache
        const tagIds = freshData.map((tag) => tag.id);
        this.ruuviCollector.markTagsAsSent(tagIds);

        this.logDataSummary(freshData);
      } else {
        console.error("❌ Failed to send data to TRMNL");
      }
    } catch (error) {
      console.error(
        "❌ Error in data cycle:",
        error instanceof Error ? error.message : error
      );
    }
  }

  private logDataSummary(tagData: RuuviTagData[]): void {
    console.log("📋 Data summary:");
    tagData.forEach((tag) => {
      const temp = tag.temperature?.toFixed(1) ?? "N/A";
      const humidity = tag.humidity?.toFixed(0) ?? "N/A";
      const battery = tag.battery ? `${tag.battery.toFixed(2)}V` : "N/A";

      console.log(`   ${tag.name}: ${temp}°C, ${humidity}%, ${battery}`);
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n🔄 Received ${signal}, shutting down gracefully...`);
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
  console.log("🏷️  RuuviTRMNL - RuuviTag to TRMNL E-ink Display Bridge");
  console.log("📅 Starting at:", new Date().toLocaleString());

  try {
    // Validate configuration
    const config = configManager.getConfig();
    console.log("⚙️  Configuration loaded successfully");

    if (!configManager.getTrmnlWebhookUrl()) {
      throw new Error(
        "TRMNL webhook URL not configured. Please check config.json"
      );
    }

    // Create and start the application
    const app = new RuuviTrmnlApp();
    await app.start();

    console.log("\n🎯 Application running. Press Ctrl+C to stop.");
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
