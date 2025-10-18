import { configManager } from "./config";
import { RuuviTagData, RawRuuviData, RawRuuviTag } from "./types";
import { CacheManager } from "./cache-manager";
import { Logger } from "./logger";

const ruuvi = require("node-ruuvitag");

export class RuuviCollector {
  private tagData = new Map<string, RuuviTagData>();
  private discoveredTags = new Set<string>();
  private isScanning = false;
  private cacheManager: CacheManager;

  constructor(cacheManager?: CacheManager) {
    this.cacheManager = cacheManager || new CacheManager();
    this.setupRuuviListeners();
  }

  public async initialize(): Promise<void> {
    await this.cacheManager.initialize();
  }

  private setupRuuviListeners(): void {
    // Listen for newly discovered tags
    ruuvi.on("found", (tag: RawRuuviTag) => {
      if (!this.discoveredTags.has(tag.id)) {
        this.discoveredTags.add(tag.id);
        const config = configManager.getConfig();
        const tagName = configManager.getTagAlias(tag.id);

        Logger.log(
          `🎯 Found RuuviTag: ${tagName} (${tag.id.substring(0, 8)}...)`
        );

        // Initialize tag data
        this.tagData.set(tag.id, {
          id: tag.id.substring(0, 8),
          name: tagName,
          lastUpdated: new Date().toISOString(),
          status: "active",
        });

        // Listen for data updates from this tag
        tag.on("updated", (data: RawRuuviData) => {
          this.updateTagData(tag.id, data);
        });
      }
    });

    // Listen for warnings
    ruuvi.on("warning", (message: string) => {
      Logger.warn(`⚠️  RuuviTag warning: ${message}`);
    });
  }

  private updateTagData(tagId: string, rawData: RawRuuviData): void {
    const existing = this.tagData.get(tagId);
    if (!existing) return;

    const updatedTag: RuuviTagData = {
      ...existing,
      lastUpdated: new Date().toISOString(),
      status: "active",
    };

    // Only set defined values
    if (rawData.temperature !== undefined) {
      updatedTag.temperature = rawData.temperature;
      updatedTag.lastTemperatureUpdate = new Date().toISOString();
    }
    if (rawData.humidity !== undefined) updatedTag.humidity = rawData.humidity;
    if (rawData.pressure !== undefined)
      updatedTag.pressure = rawData.pressure / 100; // Convert to hPa
    if (rawData.battery !== undefined)
      updatedTag.battery = rawData.battery / 1000; // Convert to volts
    if (rawData.rssi !== undefined) updatedTag.signal = rawData.rssi;
    if (rawData.accelerationX !== undefined)
      updatedTag.accelerationX = rawData.accelerationX;
    if (rawData.accelerationY !== undefined)
      updatedTag.accelerationY = rawData.accelerationY;
    if (rawData.accelerationZ !== undefined)
      updatedTag.accelerationZ = rawData.accelerationZ;

    this.tagData.set(tagId, updatedTag);

    // Update cache and check if data changed
    this.cacheManager.updateTagData(updatedTag);
  }

  public startScanning(): void {
    if (this.isScanning) {
      Logger.log("ℹ️  Already scanning...");
      return;
    }

    this.isScanning = true;
    Logger.log("🔍 Starting RuuviTag scan...");

    // The ruuvi library automatically starts scanning when we set up listeners
    // So we don't need to explicitly call a start method
  }

  public stopScanning(): void {
    this.isScanning = false;
    Logger.log("⏹️  Stopping RuuviTag scan...");
    // Note: node-ruuvitag doesn't have a clean stop method
  }

  public getActiveTagData(): RuuviTagData[] {
    const config = configManager.getConfig();
    const staleThreshold = Date.now() - config.ruuvi.dataRetentionTime;
    const activeTags: RuuviTagData[] = [];

    for (const [tagId, data] of this.tagData.entries()) {
      const lastUpdated = new Date(data.lastUpdated).getTime();

      if (lastUpdated < staleThreshold) {
        // Mark as stale if no recent data
        this.tagData.set(tagId, { ...data, status: "stale" });
      }

      // Include active and recently stale tags
      if (data.status !== "offline") {
        activeTags.push(data);
      }
    }

    // Sort by last updated (most recent first) and limit results
    return activeTags
      .sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      )
      .slice(0, config.trmnl.maxTagsToDisplay);
  }

  public getStats(): {
    totalDiscovered: number;
    activeCount: number;
    staleCount: number;
  } {
    const active = Array.from(this.tagData.values()).filter(
      (tag) => tag.status === "active"
    );
    const stale = Array.from(this.tagData.values()).filter(
      (tag) => tag.status === "stale"
    );

    return {
      totalDiscovered: this.discoveredTags.size,
      activeCount: active.length,
      staleCount: stale.length,
    };
  }

  public async findTagsSnapshot(): Promise<RuuviTagData[]> {
    try {
      Logger.log("📡 Taking RuuviTag snapshot...");
      const tags = await ruuvi.findTags();
      Logger.log(`📋 Snapshot found ${tags.length} tag(s)`);
      return this.getActiveTagData();
    } catch (error) {
      Logger.log("ℹ️  Snapshot method found no tags (normal if none nearby)");
      return this.getActiveTagData();
    }
  }

  /**
   * Get tags that have changed and are configured in tagAliases
   */
  public getChangedTagsForSending(): RuuviTagData[] {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getChangedTags(allowedTagIds);
  }

  /**
   * Get all configured tags (from cache), regardless of change status
   */
  public getAllConfiguredTags(): RuuviTagData[] {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getAllTags(allowedTagIds);
  }

  /**
   * Check if any configured tags have changed
   */
  public hasChangedConfiguredTags(): boolean {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getChangedTags(allowedTagIds).length > 0;
  }

  /**
   * Mark tags as sent to TRMNL
   */
  public markTagsAsSent(tagIds: string[]): void {
    this.cacheManager.markTagsAsSent(tagIds);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalTags: number;
    allowedTags: number;
    pendingSend: number;
  } {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getCacheStatsForAllowedTags(allowedTagIds);
  }

  /**
   * Force save cache (useful for graceful shutdown)
   */
  public async saveCache(): Promise<void> {
    await this.cacheManager.forceSave();
  }
}
