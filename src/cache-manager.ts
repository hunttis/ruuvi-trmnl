import * as fs from "fs";
import * as path from "path";
import { RuuviTagData } from "./types";

export interface CacheEntry {
  data: RuuviTagData;
  hash: string;
  lastSent?: string | undefined;
}

export interface TagCache {
  [tagId: string]: CacheEntry;
}

export class CacheManager {
  private cacheFilePath: string;
  private cache: TagCache = {};
  private initialized = false;

  constructor(cacheFileName: string = "ruuvi-cache.json") {
    this.cacheFilePath = path.join(process.cwd(), cacheFileName);
  }

  /**
   * Initialize the cache by loading from file
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadFromFile();
      console.log(`📁 Cache loaded from ${this.cacheFilePath}`);
    } catch (error) {
      console.log(`📁 Creating new cache file at ${this.cacheFilePath}`);
      await this.saveToFile();
    }

    this.initialized = true;
  }

  /**
   * Update tag data in cache and return whether data has changed
   */
  public updateTagData(tagData: RuuviTagData): boolean {
    const tagId = tagData.id;
    const newHash = this.generateDataHash(tagData);

    const existingEntry = this.cache[tagId];
    const hasChanged = !existingEntry || existingEntry.hash !== newHash;

    if (hasChanged) {
      this.cache[tagId] = {
        data: { ...tagData },
        hash: newHash,
        ...(existingEntry?.lastSent && { lastSent: existingEntry.lastSent }),
      };

      console.log(
        `🔄 Cache updated for ${tagData.name || tagId}: ${
          hasChanged ? "CHANGED" : "unchanged"
        }`
      );
    }

    return hasChanged;
  }

  /**
   * Get tags that have changed since last sent and are in the allowed list
   */
  public getChangedTags(allowedTagIds: string[]): RuuviTagData[] {
    const changedTags: RuuviTagData[] = [];

    for (const [tagId, entry] of Object.entries(this.cache)) {
      // Only include tags that are in the allowed list (tagAliases)
      const shortId = tagId.substring(0, 8);
      if (!allowedTagIds.includes(shortId)) {
        continue;
      }

      // Check if data has changed since last sent
      const hasChangedSinceLastSent =
        !entry.lastSent ||
        new Date(entry.data.lastUpdated) > new Date(entry.lastSent);

      if (hasChangedSinceLastSent) {
        changedTags.push(entry.data);
      }
    }

    return changedTags;
  }

  /**
   * Mark tags as sent to TRMNL
   */
  public markTagsAsSent(tagIds: string[]): void {
    const sentTime = new Date().toISOString();

    for (const tagId of tagIds) {
      if (this.cache[tagId]) {
        this.cache[tagId].lastSent = sentTime;
      }
    }

    // Save to file after marking as sent
    this.saveToFile().catch((error) => {
      console.error(
        "❌ Failed to save cache after marking tags as sent:",
        error
      );
    });
  }

  /**
   * Get all cached tag data (for debugging/status)
   */
  public getAllCachedTags(): RuuviTagData[] {
    return Object.values(this.cache).map((entry) => entry.data);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalTags: number;
    pendingSend: number;
    allowedTags: number;
    allowedTagIds: string[];
  } {
    const totalTags = Object.keys(this.cache).length;

    // This will need to be called with allowed tag IDs to get accurate pending count
    return {
      totalTags,
      pendingSend: 0, // Will be calculated when called with allowed IDs
      allowedTags: 0, // Will be calculated when called with allowed IDs
      allowedTagIds: [], // Will be populated when called with allowed IDs
    };
  }

  /**
   * Get cache statistics for specific allowed tags
   */
  public getCacheStatsForAllowedTags(allowedTagIds: string[]): {
    totalTags: number;
    pendingSend: number;
    allowedTags: number;
  } {
    const totalTags = Object.keys(this.cache).length;
    let allowedTags = 0;
    let pendingSend = 0;

    for (const [tagId, entry] of Object.entries(this.cache)) {
      const shortId = tagId.substring(0, 8);
      if (allowedTagIds.includes(shortId)) {
        allowedTags++;

        const hasChangedSinceLastSent =
          !entry.lastSent ||
          new Date(entry.data.lastUpdated) > new Date(entry.lastSent);

        if (hasChangedSinceLastSent) {
          pendingSend++;
        }
      }
    }

    return { totalTags, allowedTags, pendingSend };
  }

  /**
   * Persist cache to file
   */
  private async saveToFile(): Promise<void> {
    try {
      const cacheData = {
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        cache: this.cache,
      };

      await fs.promises.writeFile(
        this.cacheFilePath,
        JSON.stringify(cacheData, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("❌ Failed to save cache to file:", error);
      throw error;
    }
  }

  /**
   * Load cache from file
   */
  private async loadFromFile(): Promise<void> {
    try {
      const fileContent = await fs.promises.readFile(
        this.cacheFilePath,
        "utf8"
      );
      const cacheData = JSON.parse(fileContent);

      if (cacheData.cache) {
        this.cache = cacheData.cache;
        console.log(
          `📁 Loaded ${Object.keys(this.cache).length} cached entries from file`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, start with empty cache
        this.cache = {};
        return;
      }
      console.error("❌ Failed to load cache from file:", error);
      throw error;
    }
  }

  /**
   * Generate a hash for tag data to detect changes
   */
  private generateDataHash(tagData: RuuviTagData): string {
    // Create a hash based on the meaningful data values
    const significantData = {
      temperature: tagData.temperature
        ? Math.round(tagData.temperature * 10) / 10
        : undefined,
      humidity: tagData.humidity
        ? Math.round(tagData.humidity * 10) / 10
        : undefined,
      pressure: tagData.pressure
        ? Math.round(tagData.pressure * 100) / 100
        : undefined,
      battery: tagData.battery
        ? Math.round(tagData.battery * 100) / 100
        : undefined,
      signal: tagData.signal,
      status: tagData.status,
    };

    // Simple hash generation (good enough for change detection)
    return Buffer.from(JSON.stringify(significantData)).toString("base64");
  }

  /**
   * Force save cache (useful for shutdown)
   */
  public async forceSave(): Promise<void> {
    await this.saveToFile();
  }

  /**
   * Clear cache (for testing or reset)
   */
  public clearCache(): void {
    this.cache = {};
    this.saveToFile().catch((error) => {
      console.error("❌ Failed to save cleared cache:", error);
    });
  }
}
