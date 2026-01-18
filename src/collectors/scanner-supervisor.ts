import { ExternalRuuviScanner } from "./external-ruuvi-scanner";
import { Logger } from "@/lib/logger";
import { exec } from "child_process";

export interface SupervisorOptions {
  pythonPath?: string;
  scriptPath?: string;
  pollIntervalMs?: number; // how often to check memory
  maxRssKb?: number; // threshold in KB to restart
  maxBackoffMs?: number;
}

export class ScannerSupervisor {
  private scanner: ExternalRuuviScanner;
  private opts: Required<SupervisorOptions>;
  private backoffMs = 1000;
  private restartTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(opts?: SupervisorOptions) {
    this.opts = {
      pythonPath: opts?.pythonPath || process.env.PYTHON_PATH || "python3",
      scriptPath: opts?.scriptPath || "scanners/ruuvi_ruuvitag_sensor_scanner.py",
      pollIntervalMs: opts?.pollIntervalMs ?? 30_000,
      maxRssKb: opts?.maxRssKb ?? 200 * 1024, // 200 MB
      maxBackoffMs: opts?.maxBackoffMs ?? 60_000,
    };

    this.scanner = new ExternalRuuviScanner(this.opts.pythonPath, this.opts.scriptPath);

    this.scanner.on("started", () => {
      Logger.log("Scanner started");
      this.backoffMs = 1000; // reset backoff on success
      this.startMemoryPoll();
    });

    this.scanner.on("stderr", (m: string) => Logger.warn(`Scanner stderr: ${m}`));

    this.scanner.on("error", (err: Error) => Logger.error(`Scanner error: ${err.message}`));

    this.scanner.on("exit", (code: number) => {
      Logger.warn(`Scanner exited with code ${code}`);
      this.stopMemoryPoll();
      this.scheduleRestart();
    });
  }

  // Allow external access to the managed scanner instance for event subscriptions
  public get scannerInstance(): ExternalRuuviScanner {
    return this.scanner;
  }

  public start(): void {
    if ((this as any).running) return;
    Logger.log("Supervisor: starting scanner");
    this.scanner.start();
    (this as any).running = true;
  }

  public stop(): void {
    Logger.log("Supervisor: stopping scanner");
    this.clearRestartTimer();
    this.stopMemoryPoll();
    this.scanner.stop();
    (this as any).running = false;
  }

  private scheduleRestart(): void {
    this.clearRestartTimer();
    const wait = Math.min(this.backoffMs, this.opts.maxBackoffMs);
    Logger.log(`Supervisor: scheduling restart in ${wait}ms`);
    this.restartTimer = setTimeout(() => {
      Logger.log("Supervisor: restarting scanner now");
      this.scanner.start();
      this.backoffMs = Math.min(this.backoffMs * 2, this.opts.maxBackoffMs);
    }, wait);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private startMemoryPoll(): void {
    this.stopMemoryPoll();
    this.pollTimer = setInterval(() => this.checkChildMemory(), this.opts.pollIntervalMs);
  }

  private stopMemoryPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private checkChildMemory(): void {
    const proc = this.scanner?.procHandle as any;
    if (!proc || !proc.pid) return;
    const pid = proc.pid;

    // Use ps to get RSS in KB (works on macOS and Linux)
    exec(`ps -o rss= -p ${pid}`, (err, stdout) => {
      if (err) {
        Logger.warn(`Supervisor: failed to read RSS for pid ${pid}: ${String(err)}`);
        return;
      }
      const rssKb = parseInt(stdout.trim(), 10) || 0;
      Logger.log(`Supervisor: scanner pid=${pid} rss=${rssKb}KB`);
      if (rssKb > this.opts.maxRssKb) {
        Logger.warn(`Supervisor: RSS ${rssKb}KB exceeded ${this.opts.maxRssKb}KB, restarting scanner`);
        try {
          proc.kill();
        } catch (e) {
          Logger.error(`Supervisor: failed to kill scanner pid ${pid}: ${String(e)}`);
        }
      }
    });
  }
}

export default ScannerSupervisor;
