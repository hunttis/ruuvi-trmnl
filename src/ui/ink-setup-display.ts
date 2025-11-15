import React from "react";
import type { SetupStatus } from "@/ui/ink-setup";
import type { DiscoveredTag } from "@/setup/setup-tags";

export { SetupStatus, DiscoveredTag };

export class InkSetupDisplay {
  private inkInstance: any = null;
  private SetupComponent: any = null;
  private onKeyPressCallback?: (key: string) => void;
  private currentStatus: SetupStatus = {
    isScanning: false,
    startTime: new Date(),
    discoveredTags: new Map(),
  };

  public async start(): Promise<void> {
    // Dynamically import the ESM ink module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ink: any = await (eval('import("ink")') as Promise<any>);
    const render = ink.render;

    // Import the compiled setup component
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const setupModule = require("./ink-setup");
    const createSetupUI = setupModule.createSetupUI;

    this.SetupComponent = await createSetupUI(ink);

    const App = () => {
      const [status, setStatus] = React.useState<SetupStatus>(
        this.currentStatus
      );

      React.useEffect(() => {
        const interval = setInterval(() => {
          setStatus({ ...this.currentStatus });
        }, 100);

        return () => clearInterval(interval);
      }, []);

      return React.createElement(this.SetupComponent, {
        status,
        onKeyPress: (key: string) => {
          if (this.onKeyPressCallback) {
            this.onKeyPressCallback(key);
          }
        },
      });
    };

    this.inkInstance = render(React.createElement(App));
  }

  public stop(): void {
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }
  }

  public updateStatus(status: Partial<SetupStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...status };
  }

  public setKeyPressCallback(callback: (key: string) => void): void {
    this.onKeyPressCallback = callback;
  }
}
