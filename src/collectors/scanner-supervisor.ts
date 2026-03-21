import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import { Logger } from "@/lib/logger";
import { exec } from "child_process";

export interface SupervisorOptions {
  pythonPath?: string;
  scriptPath?: string;
  pollIntervalMs?: number;
  maxRssKb?: number;
  maxBackoffMs?: number;
  pidFilePath?: string;
}

export interface ScannerPayload {
  address: string;
  timestamp?: number | null;
  data?: Record<string, unknown>;
}

export class ScannerSupervisor extends EventEmitter {
  private proc: ChildProcess | null = null;
  private opts: Required<SupervisorOptions>;
  private pollTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(opts?: SupervisorOptions) {
    super();
    this.opts = {
      pythonPath: opts?.pythonPath || process.env.PYTHON_PATH || "python3",
      scriptPath:
        opts?.scriptPath || "scanners/ruuvi_ruuvitag_sensor_scanner.py",
      pollIntervalMs: opts?.pollIntervalMs ?? 30_000,
      maxRssKb: opts?.maxRssKb ?? 200 * 1024,
      maxBackoffMs: opts?.maxBackoffMs ?? 60_000,
      pidFilePath: opts?.pidFilePath || "ruuvi-scanner.pid",
    };

    Logger.log(`Supervisor: using Python path: ${this.opts.pythonPath}`);
    Logger.log(`Supervisor: using script: ${this.opts.scriptPath}`);
  }

  private writePidFile(pid: number): void {
    try {
      fs.writeFileSync(this.opts.pidFilePath, String(pid), "utf-8");
    } catch (err) {
      Logger.warn(
        `Supervisor: failed to write PID file: ${String(err)}`,
      );
    }
  }

  private deletePidFile(): void {
    try {
      if (fs.existsSync(this.opts.pidFilePath)) {
        fs.unlinkSync(this.opts.pidFilePath);
      }
    } catch (err) {
      Logger.warn(
        `Supervisor: failed to delete PID file: ${String(err)}`,
      );
    }
  }

  public get scannerInstance(): EventEmitter {
    return this;
  }

  public start(): void {
    if (this.running) return;
    Logger.log("Supervisor: starting scanner");
    this.running = true;
    this.spawnScanner();
  }

  private spawnScanner(): void {
    const scriptAbsPath = path.resolve(this.opts.scriptPath);

    this.proc = spawn(this.opts.pythonPath, [scriptAbsPath], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    if (this.proc.pid) {
      this.writePidFile(this.proc.pid);
    }

    this.setupProcessHandlers();
  }

  private setupProcessHandlers(): void {
    if (!this.proc) return;

    const proc = this.proc;

    proc.on("error", (err) => {
      Logger.error(`Scanner process error: ${err.message}`);
      this.emit("error", err);
    });

    proc.on("exit", (code, signal) => {
      Logger.warn(`Scanner exited with code ${code}, signal ${signal}`);
      this.stopMemoryPoll();
      this.deletePidFile();
      this.emit("exit", code ?? 0);
    });

    if (proc.stdout) {
      const rl = readline.createInterface({
        input: proc.stdout,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        this.handleStdoutLine(line.trim());
      });
    }

    if (proc.stderr) {
      const rl = readline.createInterface({
        input: proc.stderr,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          Logger.warn(`Scanner stderr: ${trimmed}`);
          this.emit("stderr", trimmed);
        }
      });
    }
  }

  private handleStdoutLine(line: string): void {
    if (!line) return;

    try {
      const msg = JSON.parse(line) as Record<string, unknown>;

      if (msg.status === "started") {
        Logger.log("Scanner started");
        this.emit("started");
        this.startMemoryPoll();
        return;
      }

      if (msg.debug) {
        Logger.log(`Scanner debug: ${msg.debug}`);
        return;
      }

      if (msg.error) {
        Logger.error(`Scanner error: ${msg.error}`);
        if (msg.exception) {
          Logger.error(`Scanner exception: ${msg.exception}`);
        }
        return;
      }

      if (msg.address && msg.data) {
        const payload: ScannerPayload = {
          address: String(msg.address),
          timestamp:
            typeof msg.timestamp === "number" ? msg.timestamp : null,
          data: msg.data as Record<string, unknown>,
        };
        this.emit("payload", payload);
      }
    } catch {
      // Not valid JSON, ignore
    }
  }

  public stop(): void {
    Logger.log("Supervisor: stopping scanner");
    this.running = false;
    this.stopMemoryPoll();
    this.deletePidFile();

    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
  }

  private startMemoryPoll(): void {
    this.stopMemoryPoll();
    this.pollTimer = setInterval(
      () => this.checkChildMemory(),
      this.opts.pollIntervalMs,
    );
  }

  private stopMemoryPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private checkChildMemory(): void {
    if (!this.proc?.pid) return;
    const pid = this.proc.pid;

    exec(`ps -o rss= -p ${pid}`, (err, stdout) => {
      if (err) {
        Logger.warn(
          `Supervisor: failed to read RSS for pid ${pid}: ${String(err)}`,
        );
        return;
      }
      const rssKb = parseInt(stdout.trim(), 10) || 0;
      Logger.log(`Supervisor: scanner pid=${pid} rss=${rssKb}KB`);

      if (rssKb > this.opts.maxRssKb) {
        Logger.warn(
          `Supervisor: RSS ${rssKb}KB exceeded ${this.opts.maxRssKb}KB - restarting scanner`,
        );
        this.restartScanner();
      }
    });
  }

  private restartScanner(): void {
    if (!this.running) return;

    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }

    this.spawnScanner();
  }
}

export default ScannerSupervisor;
