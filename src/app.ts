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
  private lastSentTime: number = 0;
  private readonly minSendInterval: number = 5 * 60 * 1000; // 5 minutes in milliseconds

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

      // Check if any configured tags have changed
      const hasChanges = this.ruuviCollector.hasChangedConfiguredTags();

      if (!hasChanges) {
        console.log(
          "ℹ️  No changed data for configured tags, skipping TRMNL update"
        );
        return;
      }

      // Check rate limiting (5 minutes between sends)
      const now = Date.now();
      const timeSinceLastSend = now - this.lastSentTime;

      if (this.lastSentTime > 0 && timeSinceLastSend < this.minSendInterval) {
        const waitTime = Math.ceil(
          (this.minSendInterval - timeSinceLastSend) / 60000
        );
        console.log(
          `⏰ Rate limited: Must wait ${waitTime} more minutes before next send`
        );
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

      console.log(
        `📤 Sending ${completeDataset.length} sensor readings to TRMNL (all configured sensors)`
      );

      // Send to TRMNL
      const success = await this.trmnlSender.sendRuuviData(completeDataset);

      if (success) {
        this.lastSentTime = now; // Update last sent time

        console.log(
          `✅ Successfully sent ${completeDataset.length} readings to TRMNL`
        );

        // Mark all existing tags as sent in cache (not placeholders)
        const existingTagIds = existingTags.map((tag) => tag.id);
        this.ruuviCollector.markTagsAsSent(existingTagIds);

        this.logDataSummary(completeDataset);
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
