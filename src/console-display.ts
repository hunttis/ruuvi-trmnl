import { RuuviTagData } from "./types";
import stringWidth from "string-width";

export interface AppStatus {
  isRunning: boolean;
  startTime: Date;
  lastUpdateTime?: Date;
  lastSentTime?: Date;
  nextSendTime?: Date;
  collectorStats: {
    totalDiscovered: number;
    activeCount: number;
    staleCount: number;
  };
  cacheStats: {
    totalTags: number;
    allowedTags: number;
    pendingSend: number;
  };
  webhookInfo: {
    url: string;
    strategy: string;
    timeout: number;
  };
  trmnlStats: {
    totalSent: number;
    lastResponseCode?: number;
    lastResponseMessage?: string;
  };
  lastSentData?: any;
  tags?: RuuviTagData[];
  lastError?: string;
  rateLimitedUntil?: Date;
  rateLimitRemainingMinutes?: number;
}

export class ConsoleDisplay {
  private displayInterval: NodeJS.Timeout | null = null;
  private status: AppStatus;
  private readonly refreshRate = 2000;
  private lastOutput: string = "";
  private onForceSend?: () => void;

  constructor() {
    this.status = {
      isRunning: false,
      startTime: new Date(),
      collectorStats: { totalDiscovered: 0, activeCount: 0, staleCount: 0 },
      cacheStats: { totalTags: 0, allowedTags: 0, pendingSend: 0 },
      webhookInfo: { url: "", strategy: "replace", timeout: 10000 },
      trmnlStats: { totalSent: 0 },
    };
  }

  public setForceSendCallback(callback: () => void): void {
    this.onForceSend = callback;
  }

  public start(): void {
    process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
    this.render();

    this.displayInterval = setInterval(() => {
      this.render();
    }, this.refreshRate);

    // Enable raw mode for keyboard input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      process.stdin.on("data", (key: string) => {
        // Handle spacebar (ASCII 32)
        if (key === " ") {
          if (this.onForceSend) {
            this.onForceSend();
          }
        }
        // Handle Ctrl+C (ASCII 3)
        else if (key === "\u0003") {
          this.stop();
          process.exit(0);
        }
      });
    }

    process.on("SIGINT", () => {
      this.stop();
      process.exit(0);
    });
  }

  public stop(): void {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
      this.displayInterval = null;
    }

    // Restore terminal settings
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    process.stdout.write("\x1b[?25h\n");
  }

  public updateStatus(status: Partial<AppStatus>): void {
    this.status = { ...this.status, ...status };
  }

  private padToWidth(str: string, targetWidth: number): string {
    const currentWidth = stringWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + " ".repeat(padding);
  }

  private render(): void {
    const width = process.stdout.columns || 120;
    const leftColumnWidth = Math.floor(width * 0.6);
    const rightColumnWidth = width - leftColumnWidth - 3; // 3 for separator
    const separator = "─".repeat(width);

    // Build left column content
    const leftLines = this.buildLeftColumn(leftColumnWidth);

    // Build right column content
    const rightLines = this.buildRightColumn(rightColumnWidth);

    // Combine columns
    const lines: string[] = [];
    lines.push("");
    lines.push(this.centerText("🏷️ RuuviTRMNL Dashboard", width));
    lines.push("");
    lines.push(separator);

    const maxLines = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < maxLines; i++) {
      const leftLine = i < leftLines.length ? (leftLines[i] ?? "") : "";
      const rightLine = i < rightLines.length ? (rightLines[i] ?? "") : "";
      const paddedLeft = this.padToWidth(leftLine, leftColumnWidth - 1);
      const paddedRight = this.padToWidth(rightLine, rightColumnWidth);
      lines.push(`${paddedLeft} │ ${paddedRight}`);
    }

    // Add empty lines with separator to maintain vertical line
    const targetContentLines = 20;
    while (lines.length - 5 < targetContentLines) {
      // -5 for header lines
      const paddedLeft = this.padToWidth("", leftColumnWidth - 1);
      const paddedRight = this.padToWidth("", rightColumnWidth);
      lines.push(`${paddedLeft} │ ${paddedRight}`);
    }

    lines.push("");
    lines.push(separator);
    lines.push(
      this.centerText("Press SPACE to force send • Ctrl+C to stop", width)
    );
    lines.push("");

    // Ensure minimum height
    const targetLines = 30;
    while (lines.length < targetLines) {
      lines.push("");
    }

    const newOutput = lines.join("\n");
    if (newOutput !== this.lastOutput) {
      process.stdout.write("\x1b[2J\x1b[H");
      process.stdout.write(newOutput);
      this.lastOutput = newOutput;
    }
  }

  private buildLeftColumn(width: number): string[] {
    const lines: string[] = [];

    lines.push("");
    lines.push("📊 Application Status");
    lines.push(
      `   Running: ${this.status.isRunning ? "✅ Active" : "❌ Stopped"}`
    );
    lines.push(`   Started: ${this.status.startTime.toLocaleString()}`);

    if (this.status.lastUpdateTime) {
      lines.push(
        `   Last Update: ${this.status.lastUpdateTime.toLocaleTimeString()}`
      );
    }

    const uptime = Math.floor(
      (Date.now() - this.status.startTime.getTime()) / 1000
    );
    lines.push(`   Uptime: ${this.formatDuration(uptime)}`);

    lines.push("");
    lines.push("🔗 TRMNL Connection");
    lines.push(`   Webhook: ${this.status.webhookInfo.url}`);
    lines.push(`   Strategy: ${this.status.webhookInfo.strategy}`);
    lines.push(`   Total Updates Sent: ${this.status.trmnlStats.totalSent}`);

    if (this.status.lastSentTime) {
      lines.push(
        `   Last Sent to TRMNL: ${this.status.lastSentTime.toLocaleTimeString()}`
      );
    }

    if (this.status.nextSendTime) {
      const timeUntilNext = Math.max(
        0,
        Math.floor((this.status.nextSendTime.getTime() - Date.now()) / 1000)
      );
      if (timeUntilNext > 0) {
        lines.push(
          `   Next Send Available: ${this.formatDuration(timeUntilNext)}`
        );
      } else {
        lines.push(`   Next Send Available: Now`);
      }
    }

    // Show rate limiting status if active
    if (
      this.status.rateLimitedUntil &&
      this.status.rateLimitRemainingMinutes !== undefined
    ) {
      lines.push(
        `   🚫 Rate Limited: ${this.status.rateLimitRemainingMinutes.toFixed(
          1
        )} min remaining`
      );
    }

    if (this.status.trmnlStats.lastResponseCode !== undefined) {
      const responseIcon =
        this.status.trmnlStats.lastResponseCode < 400 ? "✅" : "❌";
      lines.push(
        `   Last Response: ${responseIcon} HTTP ${this.status.trmnlStats.lastResponseCode}`
      );

      if (this.status.trmnlStats.lastResponseMessage) {
        lines.push(
          `   Response Message: ${this.status.trmnlStats.lastResponseMessage}`
        );
      }
    }

    lines.push("");
    lines.push("📈 Statistics");
    lines.push(
      `   Discovered Tags: ${this.status.collectorStats.totalDiscovered}`
    );
    lines.push(`   Active Tags: ${this.status.collectorStats.activeCount}`);
    lines.push(`   Stale Tags: ${this.status.collectorStats.staleCount}`);
    lines.push(`   Configured Tags: ${this.status.cacheStats.allowedTags}`);
    lines.push(`   Pending Changes: ${this.status.cacheStats.pendingSend}`);

    if (this.status.tags && this.status.tags.length > 0) {
      lines.push("");
      lines.push("🌡️ Sensor Readings");

      for (const tag of this.status.tags) {
        const temp =
          tag.temperature !== undefined
            ? `${tag.temperature.toFixed(1)}°C`
            : "N/A";
        const humidity =
          tag.humidity !== undefined ? `${tag.humidity.toFixed(0)}%` : "N/A";
        const battery =
          tag.battery !== undefined ? `${tag.battery.toFixed(2)}V` : "N/A";
        const age = this.getDataAge(tag.lastUpdated);
        const statusIcon = this.getStatusIcon(tag.status);

        lines.push(
          `   ${statusIcon} ${tag.name.padEnd(12)} ${temp.padStart(
            7
          )} ${humidity.padStart(5)} ${battery.padStart(6)} (${age})`
        );
      }
    }

    if (this.status.lastError) {
      lines.push("");
      lines.push("❌ Latest Error");
      lines.push(`   ${this.status.lastError}`);
    }

    return lines;
  }

  private buildRightColumn(width: number): string[] {
    const lines: string[] = [];

    lines.push("");
    lines.push("📤 Latest TRMNL Data");

    if (this.status.lastSentData) {
      lines.push("");
      try {
        const jsonString = JSON.stringify(this.status.lastSentData, null, 2);
        const jsonLines = jsonString.split("\n");

        for (const jsonLine of jsonLines) {
          // Wrap long lines to fit in the column
          if (jsonLine.length <= width - 3) {
            lines.push(`   ${jsonLine}`);
          } else {
            // Break long lines
            let remaining = jsonLine;
            while (remaining.length > 0) {
              const chunk = remaining.substring(0, width - 6);
              lines.push(`   ${chunk}`);
              remaining = remaining.substring(width - 6);
            }
          }
        }
      } catch (error) {
        lines.push("   Error formatting JSON data");
      }
    } else {
      lines.push("");
      lines.push("   No data sent yet");
      lines.push("");
      lines.push("   Press SPACE to send current");
      lines.push("   sensor data to TRMNL");
    }

    return lines;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  private getDataAge(lastUpdated: string): string {
    const age = Math.floor(
      (Date.now() - new Date(lastUpdated).getTime()) / 1000
    );

    if (age < 60) {
      return `${age}s ago`;
    } else if (age < 3600) {
      return `${Math.floor(age / 60)}m ago`;
    } else {
      return `${Math.floor(age / 3600)}h ago`;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "active":
        return "🟢";
      case "stale":
        return "🟡";
      case "offline":
        return "🔴";
      default:
        return "⚪";
    }
  }
}
