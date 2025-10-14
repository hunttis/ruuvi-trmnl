import * as fs from "fs";
import * as path from "path";

export interface Config {
  trmnl: {
    webhookUrl: string;
    refreshInterval: number;
    maxTagsToDisplay: number;
    mergeStrategy: "replace" | "deep_merge" | "stream";
    requestTimeout: number;
  };
  ruuvi: {
    scanTimeout: number;
    dataRetentionTime: number;
    tagAliases: Record<string, string>;
  };
}

class ConfigManager {
  private config: Config | null = null;
  private readonly configPath = path.join(process.cwd(), "config.json");
  private readonly templatePath = path.join(
    process.cwd(),
    "config.template.json"
  );

  public loadConfig(): Config {
    if (this.config) {
      return this.config;
    }

    try {
      // Try to load the actual config file
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        this.config = JSON.parse(configData);
        console.log("✅ Configuration loaded successfully");
        return this.config!;
      } else {
        throw new Error("Config file not found");
      }
    } catch (error) {
      console.error("❌ Failed to load configuration:");
      console.error(`   Config file: ${this.configPath}`);
      console.error(`   Template available: ${this.templatePath}`);
      console.error(
        "   Please copy config.template.json to config.json and update the values"
      );
      process.exit(1);
    }
  }

  public getConfig(): Config {
    if (!this.config) {
      return this.loadConfig();
    }
    return this.config;
  }

  public getTrmnlWebhookUrl(): string {
    const config = this.getConfig();
    if (
      !config.trmnl.webhookUrl ||
      config.trmnl.webhookUrl.includes("YOUR_TRMNL_WEBHOOK_URL_HERE")
    ) {
      throw new Error(
        "TRMNL webhook URL not configured. Please update config.json"
      );
    }
    return config.trmnl.webhookUrl;
  }

  public getTagAlias(tagId: string): string {
    const config = this.getConfig();
    // Try full MAC address first, then fall back to shortened version
    const fullId = tagId.replace(/:/g, "").toLowerCase();
    const shortId = tagId.substring(0, 8);
    return (
      config.ruuvi.tagAliases[fullId] ||
      config.ruuvi.tagAliases[shortId] ||
      `Tag ${shortId}`
    );
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
