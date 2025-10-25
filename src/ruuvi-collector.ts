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
    ruuvi.on("found", (tag: RawRuuviTag) => {
      const tagName = configManager.getTagAlias(tag.id);

      if (!this.discoveredTags.has(tag.id)) {
        this.discoveredTags.add(tag.id);

        Logger.log(
          `🎯 Found RuuviTag: ${tagName} (${tag.id.substring(0, 8)}...)`
        );

        this.tagData.set(tag.id, {
          id: tag.id.substring(0, 8),
          name: tagName,
          lastUpdated: new Date().toISOString(),
          status: "active",
        });
      }

      // Always set up the updated listener (even for rediscovered tags)
      tag.on("updated", (data: RawRuuviData) => {
        this.updateTagData(tag.id, data);
      });
    });

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

    if (rawData.temperature !== undefined) {
      updatedTag.temperature = rawData.temperature;
      updatedTag.lastTemperatureUpdate = new Date().toISOString();
    }
    if (rawData.humidity !== undefined) updatedTag.humidity = rawData.humidity;
    if (rawData.pressure !== undefined)
      updatedTag.pressure = rawData.pressure / 100;
    if (rawData.battery !== undefined)
      updatedTag.battery = rawData.battery / 1000;
    if (rawData.rssi !== undefined) updatedTag.signal = rawData.rssi;
    if (rawData.accelerationX !== undefined)
      updatedTag.accelerationX = rawData.accelerationX;
    if (rawData.accelerationY !== undefined)
      updatedTag.accelerationY = rawData.accelerationY;
    if (rawData.accelerationZ !== undefined)
      updatedTag.accelerationZ = rawData.accelerationZ;

    this.tagData.set(tagId, updatedTag);
    this.cacheManager.updateTagData(updatedTag);
  }

  public startScanning(): void {
    if (this.isScanning) {
      Logger.log("ℹ️  Already scanning...");
      return;
    }

    this.isScanning = true;
    Logger.log("🔍 Starting RuuviTag scan...");
    // Scanning starts automatically when listeners are set up
  }

  public stopScanning(): void {
    this.isScanning = false;
    Logger.log("⏹️  Stopping RuuviTag scan...");
  }

  public getActiveTagData(): RuuviTagData[] {
    const config = configManager.getConfig();
    const staleThreshold = Date.now() - config.ruuvi.dataRetentionTime;
    const activeTags: RuuviTagData[] = [];

    for (const [tagId, data] of this.tagData.entries()) {
      const lastUpdated = new Date(data.lastUpdated).getTime();

      if (lastUpdated < staleThreshold) {
        this.tagData.set(tagId, { ...data, status: "stale" });
      }

      if (data.status !== "offline") {
        activeTags.push(data);
      }
    }

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

  public getChangedTagsForSending(): RuuviTagData[] {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getChangedTags(allowedTagIds);
  }

  public getAllConfiguredTags(): RuuviTagData[] {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getAllTags(allowedTagIds);
  }

  public hasChangedConfiguredTags(): boolean {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getChangedTags(allowedTagIds).length > 0;
  }

  public markTagsAsSent(tagIds: string[]): void {
    this.cacheManager.markTagsAsSent(tagIds);
  }

  public getCacheStats(): {
    totalTags: number;
    allowedTags: number;
    pendingSend: number;
  } {
    const allowedTagIds = configManager.getOrderedTagIds();

    return this.cacheManager.getCacheStatsForAllowedTags(allowedTagIds);
  }

  public async saveCache(): Promise<void> {
    await this.cacheManager.forceSave();
  }
}
