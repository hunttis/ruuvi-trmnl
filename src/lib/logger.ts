import * as fs from "fs";
import * as path from "path";

export class Logger {
  private static suppressConsole = false;
  private static logFilePath = path.join(process.cwd(), "scanner.log");

  public static setSuppressConsole(suppress: boolean): void {
    Logger.suppressConsole = suppress;
  }

  public static log(message: string): void {
    Logger.writeToFile(`[LOG] ${message}`);
    if (!Logger.suppressConsole) {
      console.log(message);
    }
  }

  public static warn(message: string): void {
    Logger.writeToFile(`[WARN] ${message}`);
    if (!Logger.suppressConsole) {
      console.warn(message);
    }
  }

  public static error(message: string): void {
    Logger.writeToFile(`[ERROR] ${message}`);
    if (!Logger.suppressConsole) {
      console.error(message);
    }
  }

  private static writeToFile(message: string): void {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      fs.appendFileSync(Logger.logFilePath, logEntry, "utf8");
    } catch (err) {
      // If we can't write to the log file, try console as last resort
      if (Logger.suppressConsole) {
        console.error("Failed to write to scanner log:", err);
      }
    }
  }
}
