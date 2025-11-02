import { configManager } from "@/lib/config";
import {
  TrmnlWebhookPayload,
  TrmnlWebhookResponse,
  RuuviCollectionData,
  RuuviTagData,
} from "@/lib/types";
import { Logger } from "@/lib/logger";
import { ErrorLogger } from "@/lib/error-logger";

export class TrmnlWebhookSender {
  private readonly webhookUrl: string;
  private readonly requestTimeout: number;
  private readonly mergeStrategy: string;
  private totalSent: number = 0;

  constructor() {
    const config = configManager.getConfig();
    this.webhookUrl = configManager.getTrmnlWebhookUrl();
    this.requestTimeout = config.trmnl.requestTimeout;
    this.mergeStrategy = config.trmnl.mergeStrategy;
  }

  public async sendRuuviData(
    tagData: RuuviTagData[]
  ): Promise<TrmnlWebhookResponse> {
    try {
      const payload = this.formatPayload(tagData);
      const response = await this.makeWebhookRequest(payload);

      if (response.success) {
        this.totalSent++;
        Logger.log(
          `✅ Successfully sent data for ${tagData.length} tags to TRMNL`
        );
      } else {
        const errorMsg = response.message || response.error || "Unknown error";
        Logger.error(`❌ TRMNL webhook failed: ${errorMsg}`);
        await ErrorLogger.logError(errorMsg, response.statusCode);
      }

      return response;
    } catch (error: any) {
      const errorMsg = error?.message ?? "Unknown error";
      ErrorLogger.logError(`Failed to send data: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
        statusCode: 0,
      };
    }
  }

  private formatPayload(tagData: RuuviTagData[]): TrmnlWebhookPayload {
    // Helper to format dates as yy-MM-dd hh:mm
    const formatDateTime = (isoString: string): string => {
      const date = new Date(isoString);
      const yy = date.getFullYear().toString().slice(-2);
      const MM = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      return `${yy}-${MM}-${dd} ${hh}:${mm}`;
    };

    // Filter to only include template-required fields
    const filteredTags = tagData.map((tag) => ({
      name: tag.name,
      temperature:
        tag.temperature !== undefined
          ? Number(tag.temperature.toFixed(1))
          : undefined,
      humidity: tag.humidity,
      lastUpdated: formatDateTime(tag.lastUpdated),
      ...(tag.lastTemperatureUpdate && {
        lastTemperatureUpdate: formatDateTime(tag.lastTemperatureUpdate),
      }),
    }));

    const collectionData: RuuviCollectionData = {
      ruuvi_tags: filteredTags,
      lastRefresh: formatDateTime(new Date().toISOString()),
      totalTags: filteredTags.length,
    };

    const payload: TrmnlWebhookPayload = {
      merge_variables: collectionData,
    };

    if (this.mergeStrategy !== "replace") {
      payload.merge_strategy = this.mergeStrategy as "deep_merge" | "stream";
    }

    const payloadSize = JSON.stringify(payload).length;
    Logger.log(
      `📦 Payload size: ${payloadSize} bytes (limit: 2KB for standard, 5KB for TRMNL+)`
    );

    if (payloadSize > 2048) {
      Logger.warn(
        `⚠  Payload size (${payloadSize}B) exceeds standard limit (2KB). Consider TRMNL+ or reduce data.`
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

      if (response.ok) {
        try {
          const jsonResponse = await response.text();
          if (jsonResponse.trim()) {
            const parsed = JSON.parse(jsonResponse);
            return { success: true, statusCode: response.status, ...parsed };
          }
        } catch {}

        return {
          success: true,
          message: `HTTP ${response.status} ${response.statusText}`,
          statusCode: response.status,
        };
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        const errorMessage =
          response.status === 429
            ? `Rate limited - will retry later`
            : `HTTP ${response.status}: ${errorText}`;

        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
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
      Logger.log("🔍 Testing TRMNL webhook connection...");

      const testPayload: TrmnlWebhookPayload = {
        merge_variables: {
          test: true,
          timestamp: new Date().toISOString(),
          message: "RuuviTRMNL connection test",
        },
      };

      const response = await this.makeWebhookRequest(testPayload);

      if (response.success) {
        Logger.log("✅ TRMNL webhook connection test successful");
        return true;
      } else {
        Logger.error(
          `❌ TRMNL webhook connection test failed: ${response.error}`
        );
        return false;
      }
    } catch (error: any) {
      Logger.error(
        `❌ TRMNL webhook connection test error: ${error?.message ?? "Unknown"}`
      );
      return false;
    }
  }

  public getWebhookInfo(): { url: string; strategy: string; timeout: number } {
    return {
      url: this.webhookUrl.replace(/\/[^\/]+$/, "/***"),
      strategy: this.mergeStrategy,
      timeout: this.requestTimeout,
    };
  }

  public getTotalSent(): number {
    return this.totalSent;
  }
}
