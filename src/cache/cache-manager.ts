import * as fs from "fs";
import * as path from "path";
import { RuuviTagData } from "@/lib/types";
import { Logger } from "@/lib/logger";

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

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadFromFile();
      Logger.log(`📁 Cache loaded from ${this.cacheFilePath}`);
    } catch (error) {
      Logger.log(`📁 Creating new cache file at ${this.cacheFilePath}`);
      await this.saveToFile();
    }

    this.initialized = true;
  }

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

      Logger.log(
        `🔄 Cache updated for ${tagData.name || tagId}: ${
          hasChanged ? "CHANGED" : "unchanged"
        }`
      );
    }

    return hasChanged;
  }

  public getChangedTags(allowedTagIds: string[]): RuuviTagData[] {
    const changedTagMap = new Map<string, RuuviTagData>();

    for (const [tagId, entry] of Object.entries(this.cache)) {
      const shortId = tagId.substring(0, 8);
      if (!allowedTagIds.includes(shortId)) {
        continue;
      }

      const hasChangedSinceLastSent =
        !entry.lastSent ||
        new Date(entry.data.lastUpdated) > new Date(entry.lastSent);

      if (hasChangedSinceLastSent) {
        changedTagMap.set(shortId, entry.data);
      }
    }
    const changedTags: RuuviTagData[] = [];
    for (const tagId of allowedTagIds) {
      if (changedTagMap.has(tagId)) {
        changedTags.push(changedTagMap.get(tagId)!);
      }
    }

    return changedTags;
  }

  public markTagsAsSent(tagIds: string[]): void {
    const sentTime = new Date().toISOString();

    for (const tagId of tagIds) {
      if (this.cache[tagId]) {
        this.cache[tagId].lastSent = sentTime;
      }
    }

    this.saveToFile().catch((error) => {
      Logger.error(
        "❌ Failed to save cache after marking tags as sent:" + error
      );
    });
  }

  public getAllCachedTags(): RuuviTagData[] {
    return Object.values(this.cache).map((entry) => entry.data);
  }

  public getAllTags(allowedTagIds: string[]): RuuviTagData[] {
    const tags: RuuviTagData[] = [];
    const tagMap = new Map<string, RuuviTagData>();

    for (const [tagId, entry] of Object.entries(this.cache)) {
      const shortId = tagId.substring(0, 8);
      if (allowedTagIds.includes(shortId)) {
        tagMap.set(shortId, entry.data);
      }
    }
    for (const tagId of allowedTagIds) {
      if (tagMap.has(tagId)) {
        tags.push(tagMap.get(tagId)!);
      }
    }

    return tags;
  }

  public getCacheStats(): {
    totalTags: number;
    pendingSend: number;
    allowedTags: number;
    allowedTagIds: string[];
  } {
    const totalTags = Object.keys(this.cache).length;

    return {
      totalTags,
      pendingSend: 0,
      allowedTags: 0,
      allowedTagIds: [],
    };
  }

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

  public getMostRecentSentTime(): number {
    let mostRecent = 0;

    for (const entry of Object.values(this.cache)) {
      if (entry.lastSent) {
        const sentTime = new Date(entry.lastSent).getTime();
        if (sentTime > mostRecent) {
          mostRecent = sentTime;
        }
      }
    }

    return mostRecent;
  }

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
      Logger.error("❌ Failed to save cache to file:" + error);
      throw error;
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const fileContent = await fs.promises.readFile(
        this.cacheFilePath,
        "utf8"
      );
      const cacheData = JSON.parse(fileContent);

      if (cacheData.cache) {
        this.cache = cacheData.cache;
        Logger.log(
          `📁 Loaded ${Object.keys(this.cache).length} cached entries from file`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.cache = {};
        return;
      }
      Logger.error("❌ Failed to load cache from file:" + error);
      throw error;
    }
  }

  private generateDataHash(tagData: RuuviTagData): string {
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

    return Buffer.from(JSON.stringify(significantData)).toString("base64");
  }

  public async forceSave(): Promise<void> {
    await this.saveToFile();
  }

  public clearCache(): void {
    this.cache = {};
    this.saveToFile().catch((error) => {
      Logger.error("❌ Failed to save cleared cache:" + error);
    });
  }
}
