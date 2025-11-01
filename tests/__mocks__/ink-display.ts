import { AppStatus } from "../../src/ink-display";

export class InkDisplay {
  private status: AppStatus;
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
    // Mock implementation - does nothing
  }

  public stop(): void {
    // Mock implementation - does nothing
  }

  public updateStatus(status: Partial<AppStatus>): void {
    this.status = { ...this.status, ...status };
  }
}

export type { AppStatus };
