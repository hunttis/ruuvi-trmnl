import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as readline from "readline";

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

  constructor(pythonPath = "python3", scriptPath = "scanners/ble_scanner.py") {
    super();
    this.pythonPath = pythonPath;
    this.scriptPath = scriptPath;
  }

  public start(): void {
    if (this.proc) return;

    this.proc = spawn(this.pythonPath, [this.scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!this.proc.stdout) throw new Error("Failed to open stdout on scanner process");

    const rl = readline.createInterface({ input: this.proc.stdout });

    rl.on("line", (line) => {
      try {
        const obj = JSON.parse(line) as ExternalPayload | { status: string };
        if ((obj as any).status === "started") {
          this.emit("started");
          return;
        }
        this.emit("payload", obj as ExternalPayload);
      } catch (err) {
        this.emit("error", new Error("Bad JSON from scanner: " + String(err)));
      }
    });

    this.proc.stderr?.on("data", (b) => {
      this.emit("stderr", b.toString());
    });

    this.proc.on("exit", (code) => {
      this.emit("exit", code ?? 0);
      this.proc = null;
    });
  }

  public stop(): void {
    if (!this.proc) return;
    this.proc.kill();
    this.proc = null;
  }
}
