import React from "react";
import { RuuviTagData } from "./types";

// We'll dynamically import this later since ink is ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createDashboard: any;

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

export class InkDisplay {
  private status: AppStatus;
  private onForceSend?: () => void;
  private updateInterval?: NodeJS.Timeout | undefined;
  private unmount?: () => void;

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

  public async start(): Promise<void> {
    // Dynamically import the ESM ink module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ink: any = await (eval('import("ink")') as Promise<any>);
    const render = ink.render;

    // Import the compiled dashboard component
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dashboardModule = require("./ink-dashboard");
    createDashboard = dashboardModule.createDashboard;

    const DashboardComponent = await createDashboard(ink);

    const App = () => {
      const [currentStatus, setCurrentStatus] = React.useState(this.status);

      React.useEffect(() => {
        // Update every 2 seconds
        const interval = setInterval(() => {
          setCurrentStatus({ ...this.status });
        }, 2000);

        this.updateInterval = interval;

        return () => {
          clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return React.createElement(DashboardComponent, {
        status: currentStatus,
        onForceSend: this.onForceSend,
      });
    };

    const { unmount } = render(React.createElement(App));
    this.unmount = unmount;
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
    if (this.unmount) {
      this.unmount();
    }
  }

  public updateStatus(status: Partial<AppStatus>): void {
    this.status = { ...this.status, ...status };
  }
}
