import { ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as readline from "readline";
import * as fs from "fs";

export interface ExternalPayload {
  address: string;
  name?: string;
  rssi?: number;
  manufacturer_data?: Record<string, string>;
  timestamp?: number;
}

export class ExternalRuuviScanner extends EventEmitter {
  private proc: ChildProcess | null = null;
  private pythonPath: string;
  private scriptPath: string;
  private pidFilePath: string;
  private monitorTimer: NodeJS.Timeout | null = null;

  constructor(
    pythonPath = "python3",
    scriptPath = "scanners/ble_scanner.py",
    pidFilePath = "ruuvi-scanner.pid",
  ) {
    super();
    this.pythonPath = pythonPath;
    this.scriptPath = scriptPath;
    this.pidFilePath = pidFilePath;
  }

  // Expose the child process for supervisors to inspect (pid, etc.)
  public get procHandle(): ChildProcess | null {
    return this.proc;
  }

  public start(): void {
    if (this.proc) return;

    // Instead of spawning the Python scanner, detect an externally started
    // scanner via a PID file. If the PID file exists and the PID corresponds
    // to a running process, expose a lightweight proc-like handle and emit
    // a "started" event so callers can monitor it.
    try {
      if (!fs.existsSync(this.pidFilePath)) {
        this.emit(
          "error",
          new Error(`PID file not found: ${this.pidFilePath}`),
        );
        return;
      }

      const pidStr = fs.readFileSync(this.pidFilePath, "utf8").trim();
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid) || pid <= 0) {
        this.emit("error", new Error(`Invalid PID in file: ${pidStr}`));
        return;
      }

      try {
        // Signal 0 doesn't actually kill the process; it throws if process doesn't exist
        process.kill(pid, 0);
      } catch (err) {
        this.emit("error", new Error(`No process with pid ${pid}`));
        return;
      }

      // Expose a minimal proc-like object with pid so supervisors can inspect it
      this.proc = { pid } as unknown as ChildProcess;
      this.emit("started");

      // Monitor PID file / process existence and emit exit when it disappears
      this.monitorTimer = setInterval(() => {
        try {
          process.kill(pid, 0);
        } catch (e) {
          // Process is gone
          if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
            this.monitorTimer = null;
          }
          this.emit("exit", 0);
          this.proc = null;
        }
      }, 2000);
    } catch (err) {
      this.emit("error", err as Error);
    }
  }

  public stop(): void {
    // We won't kill an externally managed process. Just stop monitoring it.
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.proc = null;
  }
}
