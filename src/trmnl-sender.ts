import { configManager } from "./config";
import {
  TrmnlWebhookPayload,
  TrmnlWebhookResponse,
  RuuviCollectionData,
  RuuviTagData,
} from "./types";

export class TrmnlWebhookSender {
  private readonly webhookUrl: string;
  private readonly requestTimeout: number;
  private readonly mergeStrategy: string;

  constructor() {
    const config = configManager.getConfig();
    this.webhookUrl = configManager.getTrmnlWebhookUrl();
    this.requestTimeout = config.trmnl.requestTimeout;
    this.mergeStrategy = config.trmnl.mergeStrategy;
  }

  public async sendRuuviData(tagData: RuuviTagData[]): Promise<boolean> {
    try {
      const payload = this.formatPayload(tagData);
      const response = await this.makeWebhookRequest(payload);

      if (response.success) {
        console.log(
          `✅ Successfully sent data for ${tagData.length} tags to TRMNL`
        );
        return true;
      } else {
        console.error(
          `❌ TRMNL webhook failed: ${response.message || response.error}`
        );
        return false;
      }
    } catch (error) {
      console.error(
        `❌ Error sending to TRMNL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    }
  }

  private formatPayload(tagData: RuuviTagData[]): TrmnlWebhookPayload {
    const collectionData: RuuviCollectionData = {
      ruuvi_tags: tagData,
      lastRefresh: new Date().toISOString(),
      totalTags: tagData.length,
      // scanDuration is optional and not provided
    };

    const payload: TrmnlWebhookPayload = {
      merge_variables: collectionData,
    };

    // Add merge strategy if not default
    if (this.mergeStrategy !== "replace") {
      payload.merge_strategy = this.mergeStrategy as "deep_merge" | "stream";
    }

    // Log payload size for debugging
    const payloadSize = JSON.stringify(payload).length;
    console.log(
      `📦 Payload size: ${payloadSize} bytes (limit: 2KB for standard, 5KB for TRMNL+)`
    );

    if (payloadSize > 2048) {
      console.warn(
        `⚠️  Payload size (${payloadSize}B) exceeds standard limit (2KB). Consider TRMNL+ or reduce data.`
      );
    }

    return payload;
  }

  private async makeWebhookRequest(
    payload: TrmnlWebhookPayload
  ): Promise<TrmnlWebhookResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "RuuviTRMNL/1.0",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // TRMNL typically returns 200 for success, even if the response body is minimal
      if (response.ok) {
        // Try to parse response, but don't fail if it's empty or not JSON
        try {
          const jsonResponse = await response.text();
          if (jsonResponse.trim()) {
            const parsed = JSON.parse(jsonResponse);
            return { success: true, ...parsed };
          }
        } catch {
          // Ignore JSON parse errors for successful requests
        }

        return {
          success: true,
          message: `HTTP ${response.status} ${response.statusText}`,
        };
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            error: `Request timeout after ${this.requestTimeout}ms`,
          };
        }
        return { success: false, error: error.message };
      }

      return { success: false, error: "Unknown network error" };
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      console.log("🔍 Testing TRMNL webhook connection...");

      // Send a minimal test payload
      const testPayload: TrmnlWebhookPayload = {
        merge_variables: {
          test: true,
          timestamp: new Date().toISOString(),
          message: "RuuviTRMNL connection test",
        },
      };

      const response = await this.makeWebhookRequest(testPayload);

      if (response.success) {
        console.log("✅ TRMNL webhook connection test successful");
        return true;
      } else {
        console.error(
          `❌ TRMNL webhook connection test failed: ${response.error}`
        );
        return false;
      }
    } catch (error) {
      console.error(
        `❌ TRMNL webhook connection test error: ${
          error instanceof Error ? error.message : "Unknown"
        }`
      );
      return false;
    }
  }

  public getWebhookInfo(): { url: string; strategy: string; timeout: number } {
    return {
      url: this.webhookUrl.replace(/\/[^\/]+$/, "/***"), // Hide UUID for security
      strategy: this.mergeStrategy,
      timeout: this.requestTimeout,
    };
  }
}
