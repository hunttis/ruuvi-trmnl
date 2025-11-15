import React from "react";
import type { AppStatus } from "@/ui/ink-display";
import type { SetupStatus } from "@/ui/ink-setup";

type Screen = "dashboard" | "setup";

// We'll dynamically import this later since ink is ESM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let createCombinedUI: any;

export class CombinedDisplay {
  private currentScreen: Screen = "dashboard";
  private dashboardStatus: AppStatus;
  private setupStatus: SetupStatus;
  private onForceSend?: () => void;
  private onSetupKeyPress?: (key: string) => void;
  private onScreenChange?: (screen: Screen) => void;
  private updateInterval?: NodeJS.Timeout | undefined;
  private unmount?: () => void;

  constructor() {
    this.dashboardStatus = {
      isRunning: false,
      startTime: new Date(),
      collectorStats: { totalDiscovered: 0, activeCount: 0, staleCount: 0 },
      cacheStats: { totalTags: 0, allowedTags: 0, pendingSend: 0 },
      webhookInfo: { url: "", strategy: "replace", timeout: 10000 },
      trmnlStats: { totalSent: 0 },
    };

    this.setupStatus = {
      isScanning: false,
      startTime: new Date(),
      discoveredTags: new Map(),
    };
  }

  public setForceSendCallback(callback: () => void): void {
    this.onForceSend = callback;
  }

  public setSetupKeyPressCallback(callback: (key: string) => void): void {
    this.onSetupKeyPress = callback;
  }

  public setScreenChangeCallback(callback: (screen: Screen) => void): void {
    this.onScreenChange = callback;
  }

  public setCurrentScreen(screen: Screen): void {
    this.currentScreen = screen;
  }

  public getCurrentScreen(): Screen {
    return this.currentScreen;
  }

  public async start(): Promise<void> {
    // Dynamically import the ESM ink module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ink: any = await (eval('import("ink")') as Promise<any>);
    const render = ink.render;

    // Import the compiled combined UI component
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const combinedModule = require("./ink-combined");
    createCombinedUI = combinedModule.createCombinedUI;

    const CombinedComponent = await createCombinedUI(ink);

    const App = () => {
      const [currentScreen, setCurrentScreen] = React.useState<Screen>(
        this.currentScreen
      );
      const [dashboardStatus, setDashboardStatus] = React.useState(
        this.dashboardStatus
      );
      const [setupStatus, setSetupStatus] = React.useState(this.setupStatus);

      React.useEffect(() => {
        // Update every 100ms for responsive UI
        const interval = setInterval(() => {
          setCurrentScreen(this.currentScreen);
          setDashboardStatus({ ...this.dashboardStatus });
          setSetupStatus({
            ...this.setupStatus,
            discoveredTags: new Map(this.setupStatus.discoveredTags),
          });
        }, 100);

        this.updateInterval = interval;

        return () => {
          clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return React.createElement(CombinedComponent, {
        currentScreen,
        dashboardStatus,
        setupStatus,
        onForceSend: this.onForceSend,
        onSetupKeyPress: (key: string) => {
          if (this.onSetupKeyPress) {
            this.onSetupKeyPress(key);
          }
        },
        onScreenChange: (screen: Screen) => {
          this.currentScreen = screen;
          setCurrentScreen(screen);
          // Notify the callback
          if (this.onScreenChange) {
            this.onScreenChange(screen);
          }
        },
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

  public updateDashboardStatus(status: Partial<AppStatus>): void {
    this.dashboardStatus = { ...this.dashboardStatus, ...status };
  }

  public updateSetupStatus(status: Partial<SetupStatus>): void {
    this.setupStatus = { ...this.setupStatus, ...status };
  }
}
