import * as fs from "fs";
import * as path from "path";

export class ErrorLogger {
  private static logFilePath = path.join(process.cwd(), "trmnl-errors.log");

  public static async logError(
    error: string,
    responseCode?: number
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${
        responseCode ? `HTTP ${responseCode}: ` : ""
      }${error}\n`;

      await fs.promises.appendFile(this.logFilePath, logEntry, "utf8");
    } catch (logError) {
      console.error("Failed to write to error log:", logError);
    }
  }

  public static async getRecentErrors(
    maxLines: number = 10
  ): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(this.logFilePath, "utf8");
      const lines = content.trim().split("\n");
      return lines.slice(-maxLines);
    } catch (error) {
      return [];
    }
  }
}
