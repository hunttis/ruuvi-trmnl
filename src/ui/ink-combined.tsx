import React from "react";
import type { AppStatus } from "@/ui/ink-display";
import type { SetupStatus } from "@/ui/ink-setup";

type Screen = "dashboard" | "setup";

export async function createCombinedUI(ink: any) {
  const { Box, Text, useInput, useApp } = ink;

  // Import dashboard and setup components
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dashboardModule = require("./ink-dashboard");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const setupModule = require("./ink-setup");

  const DashboardComponent = await dashboardModule.createDashboard(ink);
  const SetupComponent = await setupModule.createSetupUI(ink);

  function CombinedUI({
    currentScreen,
    dashboardStatus,
    setupStatus,
    onForceSend,
    onSetupKeyPress,
    onScreenChange,
  }: {
    currentScreen: Screen;
    dashboardStatus: AppStatus;
    setupStatus: SetupStatus;
    onForceSend?: () => void;
    onSetupKeyPress: (key: string) => void;
    onScreenChange: (screen: Screen) => void;
  }) {
    const { exit } = useApp();

    useInput((input: string, key: any) => {
      if (key.ctrl && input === "c") {
        exit();
        process.exit(0);
      }

      // Global screen switching
      if (input === "t" && currentScreen === "dashboard") {
        onScreenChange("setup");
      } else if (input === "d" && currentScreen === "setup") {
        onScreenChange("dashboard");
      } else if (input === "q" && currentScreen === "setup") {
        // Q key in setup mode returns to dashboard
        onScreenChange("dashboard");
      } else if (currentScreen === "dashboard" && input === " " && onForceSend) {
        // Space bar in dashboard mode forces send
        onForceSend();
      } else if (currentScreen === "setup") {
        // Pass other keys to setup handler
        onSetupKeyPress(input.toLowerCase());
      }
    });

    return (
      <Box flexDirection="column">
        {currentScreen === "dashboard" ? (
          <>
            {React.createElement(DashboardComponent, {
              status: dashboardStatus,
              onForceSend,
            })}
            <Box justifyContent="center" marginTop={1}>
              <Text dimColor>
                Press <Text bold color="cyan">T</Text> for Tag Setup • Space to force send • Ctrl+C to exit
              </Text>
            </Box>
          </>
        ) : (
          <>
            {React.createElement(SetupComponent, {
              status: setupStatus,
              onKeyPress: onSetupKeyPress,
            })}
            <Box justifyContent="center" marginTop={1}>
              <Text dimColor>
                Press <Text bold color="cyan">D</Text> to return to Dashboard • <Text bold color="cyan">Q</Text> to quit setup • Ctrl+C to exit
              </Text>
            </Box>
          </>
        )}
      </Box>
    );
  }

  return CombinedUI;
}
