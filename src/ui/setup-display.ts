import { DiscoveredTag } from "@/setup/setup-tags";

export interface SetupStatus {
  isScanning: boolean;
  startTime: Date;
  discoveredTags: Map<string, DiscoveredTag>;
  currentAction?: string;
  lastError?: string;
  savedCount?: number;
}

export class SetupDisplay {
  private displayInterval: NodeJS.Timeout | null = null;
  private status: SetupStatus;
  private readonly refreshRate = 2000;
  private lastOutput: string = "";
  private onKeyPress?: (key: string) => void;

  constructor() {
    this.status = {
      isScanning: false,
      startTime: new Date(),
      discoveredTags: new Map(),
    };
  }

  public setKeyPressCallback(callback: (key: string) => void): void {
    this.onKeyPress = callback;
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
        // Handle Ctrl+C (ASCII 3)
        if (key === "\u0003") {
          this.stop();
          process.exit(0);
        } else if (this.onKeyPress) {
          this.onKeyPress(key);
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

  public updateStatus(status: Partial<SetupStatus>): void {
    this.status = { ...this.status, ...status };
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
    lines.push(this.centerText("🔍 RuuviTag Setup Tool", width));
    lines.push("");
    lines.push(separator);

    const maxLines = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < maxLines; i++) {
      const leftLine = leftLines[i] || "";
      const rightLine = rightLines[i] || "";
      const paddedLeft = leftLine.padEnd(leftColumnWidth - 1);
      const paddedRight = rightLine.padEnd(rightColumnWidth);
      lines.push(`${paddedLeft} │ ${paddedRight}`);
    }

    lines.push("");
    lines.push(separator);
    lines.push(
      this.centerText(
        "Press 1-9 to set nickname • S to save • Q to quit • Ctrl+C to exit",
        width
      )
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
    lines.push("-- Scan Status --");
    lines.push(
      `   Scanning: ${this.status.isScanning ? "✅ Active" : "❌ Stopped"}`
    );
    lines.push(`   Started: ${this.status.startTime.toLocaleString()}`);

    const uptime = Math.floor(
      (Date.now() - this.status.startTime.getTime()) / 1000
    );
    lines.push(`   Uptime: ${this.formatDuration(uptime)}`);

    if (this.status.currentAction) {
      lines.push(`   Current: ${this.status.currentAction}`);
    }

    lines.push("");
    lines.push("-- Discovery Statistics --");
    lines.push(`   Total Discovered: ${this.status.discoveredTags.size}`);

    const withNicknames = Array.from(
      this.status.discoveredTags.values()
    ).filter((tag) => tag.nickname).length;
    lines.push(`   With Nicknames: ${withNicknames}`);
    lines.push(`   Ready to Save: ${withNicknames}`);

    if (this.status.savedCount !== undefined) {
      lines.push(`   Last Saved: ${this.status.savedCount} tags`);
    }

    if (this.status.discoveredTags.size > 0) {
      lines.push("");
      lines.push("-- Discovered Tags --");

      let index = 1;
      for (const [fullId, tag] of this.status.discoveredTags) {
        const nickname = tag.nickname || "<no nickname>";
        const temp = tag.data?.temperature?.toFixed(1) || "N/A";
        const humidity = tag.data?.humidity?.toFixed(0) || "N/A";
        const battery = tag.data?.battery?.toFixed(2) || "N/A";
        const age = this.getDataAge(tag.lastSeen);
        const statusIcon = this.getTagStatusIcon(tag);

        lines.push(
          `   ${statusIcon} ${index}) ${tag.shortId.padEnd(10)} ${nickname
            .substring(0, 15)
            .padEnd(15)}`
        );
        lines.push(
          `      ${temp.padStart(6)}°C ${humidity.padStart(
            3
          )}% ${battery.padStart(5)}V (${age})`
        );

        index++;
        if (index > 9) break; // Only show first 9 tags for numbering
      }

      if (this.status.discoveredTags.size > 9) {
        lines.push(
          `   ... and ${this.status.discoveredTags.size - 9} more tags`
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
    lines.push("🛠️ Actions");
    lines.push("");
    lines.push("   1-9  Set nickname for tag number");
    lines.push("   S    Save configuration to config.json");
    lines.push("   Q    Quit and save");
    lines.push("   R    Refresh display");
    lines.push("");

    lines.push("ℹ Instructions");
    lines.push("");
    lines.push("   1. Wait for RuuviTags to be discovered");
    lines.push("   2. Press number keys (1-9) to set nicknames");
    lines.push("   3. Press 'S' to save to config.json");
    lines.push("   4. Press 'Q' when finished");
    lines.push("");

    lines.push("📋 About");
    lines.push("");
    lines.push("   This tool helps you:");
    lines.push("   • Discover nearby RuuviTag sensors");
    lines.push("   • Assign friendly nicknames");
    lines.push("   • Update config.json automatically");
    lines.push("   • Set display order for TRMNL");
    lines.push("");

    if (this.status.discoveredTags.size > 0) {
      lines.push("💡 Tips");
      lines.push("");
      lines.push("   • Choose descriptive names like 'Kitchen',");
      lines.push("     'Bedroom', 'Outdoor'");
      lines.push("   • Names will appear on your TRMNL display");
      lines.push("   • You can change names anytime by");
      lines.push("     running this tool again");
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

  private getDataAge(lastSeen: Date): string {
    const age = Math.floor((Date.now() - lastSeen.getTime()) / 1000);

    if (age < 60) {
      return `${age}s ago`;
    } else if (age < 3600) {
      return `${Math.floor(age / 60)}m ago`;
    } else {
      return `${Math.floor(age / 3600)}h ago`;
    }
  }

  private getTagStatusIcon(tag: DiscoveredTag): string {
    const age = Math.floor((Date.now() - tag.lastSeen.getTime()) / 1000);

    if (age < 60) {
      return "🟢"; // Fresh data
    } else if (age < 300) {
      return "🟡"; // Recent data
    } else {
      return "🔴"; // Old data
    }
  }
}
