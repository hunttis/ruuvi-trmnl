import { RuuviTagData } from "./types";

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
  tags?: RuuviTagData[];
  lastError?: string;
}

export class ConsoleDisplay {
  private displayInterval: NodeJS.Timeout | null = null;
  private status: AppStatus;
  private readonly refreshRate = 2000;
  private lastOutput: string = "";

  constructor() {
    this.status = {
      isRunning: false,
      startTime: new Date(),
      collectorStats: { totalDiscovered: 0, activeCount: 0, staleCount: 0 },
      cacheStats: { totalTags: 0, allowedTags: 0, pendingSend: 0 },
      webhookInfo: { url: "", strategy: "replace", timeout: 10000 },
    };
  }

  public start(): void {
    process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
    this.render();

    this.displayInterval = setInterval(() => {
      this.render();
    }, this.refreshRate);

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

    process.stdout.write("\x1b[?25h\n");
  }

  public updateStatus(status: Partial<AppStatus>): void {
    this.status = { ...this.status, ...status };
  }

  private render(): void {
    const lines: string[] = [];
    const width = process.stdout.columns || 120;
    const separator = "─".repeat(width);

    lines.push("");
    lines.push(this.centerText("🏷️ RuuviTRMNL Dashboard", width));
    lines.push("");
    lines.push(separator);

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

    if (this.status.lastSentTime) {
      lines.push(
        `   Last Sent: ${this.status.lastSentTime.toLocaleTimeString()}`
      );
    }

    if (this.status.nextSendTime) {
      const timeUntilNext = Math.max(
        0,
        Math.floor((this.status.nextSendTime.getTime() - Date.now()) / 1000)
      );
      if (timeUntilNext > 0) {
        lines.push(`   Next Available: ${this.formatDuration(timeUntilNext)}`);
      } else {
        lines.push(`   Next Available: Now`);
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
          `   ${statusIcon} ${tag.name.padEnd(15)} ${temp.padStart(
            8
          )} ${humidity.padStart(6)} ${battery.padStart(7)} (${age})`
        );
      }
    }

    if (this.status.lastError) {
      lines.push("");
      lines.push("❌ Latest Error");
      lines.push(`   ${this.status.lastError}`);
    }

    lines.push("");
    lines.push(separator);
    lines.push(this.centerText("Press Ctrl+C to stop", width));
    lines.push("");
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
