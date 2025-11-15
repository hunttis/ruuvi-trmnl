import React from "react";

export interface DiscoveredTag {
  id: string;
  shortId: string;
  nickname?: string;
  lastSeen: Date;
  data?: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
    battery?: number;
    rssi?: number;
  };
}

export interface ConfiguredTag {
  id: string;
  name: string;
  lastSeen?: Date;
}

export interface SetupStatus {
  isScanning: boolean;
  startTime: Date;
  discoveredTags: Map<string, DiscoveredTag>;
  configuredTags?: ConfiguredTag[];
  currentAction?: string;
  lastError?: string;
  savedCount?: number;
}

export async function createSetupUI(ink: any) {
  const { Box, Text, useInput, useApp } = ink;

  function SetupUI({
    status,
    onKeyPress,
  }: {
    status: SetupStatus;
    onKeyPress: (key: string) => void;
  }) {
    const { exit } = useApp();

    useInput((input: string, key: any) => {
      if (key.ctrl && input === "c") {
        exit();
        process.exit(0);
      } else {
        onKeyPress(input.toLowerCase());
      }
    });

    const formatDuration = (seconds: number): string => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };

    const getDataAge = (lastSeen: Date): string => {
      const age = Math.floor((Date.now() - lastSeen.getTime()) / 1000);

      if (age < 60) {
        return `${age}s ago`;
      } else if (age < 3600) {
        return `${Math.floor(age / 60)}m ago`;
      } else {
        return `${Math.floor(age / 3600)}h ago`;
      }
    };

    const getStatusColor = (tag: DiscoveredTag): "green" | "yellow" | "red" => {
      const age = Math.floor((Date.now() - tag.lastSeen.getTime()) / 1000);

      if (age < 60) {
        return "green"; // Fresh data
      } else if (age < 300) {
        return "yellow"; // Recent data
      } else {
        return "red"; // Old data
      }
    };

    const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);

    const withNicknames = Array.from(status.discoveredTags.values()).filter(
      (tag) => tag.nickname
    ).length;

    const tagArray = Array.from(status.discoveredTags.values());

    return (
      <Box flexDirection="column" padding={1}>
        {/* Header */}
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">
            --- RuuviTag Setup Tool ---
          </Text>
        </Box>

        <Box flexDirection="row" marginBottom={1}>
          {/* Left Column */}
          <Box flexDirection="column" width="60%" paddingRight={1}>
            {/* Scan Status */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="blue"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Scan Status --
              </Text>
              <Text>
                Scanning:{" "}
                {status.isScanning ? (
                  <Text color="green">Active</Text>
                ) : (
                  <Text color="red">Stopped</Text>
                )}
              </Text>
              <Text>Started: {status.startTime.toLocaleString()}</Text>
              <Text>Uptime: {formatDuration(uptime)}</Text>
              {status.currentAction && (
                <Text>Current: {status.currentAction}</Text>
              )}
            </Box>

            {/* Discovery Statistics */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="green"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Discovery Statistics --
              </Text>
              <Text>Total Discovered: {status.discoveredTags.size}</Text>
              <Text>With Nicknames: {withNicknames}</Text>
              <Text>Ready to Save: {withNicknames}</Text>
              {status.savedCount !== undefined && (
                <Text>Last Saved: {status.savedCount} tags</Text>
              )}
            </Box>

            {/* Discovered Tags */}
            {status.discoveredTags.size > 0 && (
              <Box
                flexDirection="column"
                marginBottom={1}
                borderStyle="round"
                borderColor="yellow"
                paddingX={1}
              >
                <Text bold color="blue">
                  -- Discovered Tags --
                </Text>
                {tagArray.slice(0, 9).map((tag, index) => {
                  const nickname = tag.nickname || "<no nickname>";
                  const temp = tag.data?.temperature?.toFixed(1) || "N/A";
                  const humidity = tag.data?.humidity?.toFixed(0) || "N/A";
                  const battery = tag.data?.battery?.toFixed(2) || "N/A";
                  const age = getDataAge(tag.lastSeen);
                  const statusColor = getStatusColor(tag);

                  return (
                    <Box key={tag.id} flexDirection="column">
                      <Text>
                        <Text color={statusColor}>●</Text> {index + 1}){" "}
                        {tag.shortId.padEnd(10)} {nickname.substring(0, 15)}
                      </Text>
                      <Text dimColor>
                        {"      "}
                        {temp.padStart(6)}°C {humidity.padStart(3)}%{" "}
                        {battery.padStart(5)}V ({age})
                      </Text>
                    </Box>
                  );
                })}
                {status.discoveredTags.size > 9 && (
                  <Text dimColor>
                    ... and {status.discoveredTags.size - 9} more tags
                  </Text>
                )}
              </Box>
            )}

            {/* Configured Tags */}
            {status.configuredTags && status.configuredTags.length > 0 && (
              <Box
                flexDirection="column"
                marginBottom={1}
                borderStyle="round"
                borderColor="cyan"
                paddingX={1}
              >
                <Text bold color="blue">
                  -- Configured Tags --
                </Text>
                {status.configuredTags.map((tag) => {
                  const lastSeenText = tag.lastSeen
                    ? getDataAge(tag.lastSeen)
                    : "Never";
                  const statusColor: "green" | "yellow" | "red" = tag.lastSeen
                    ? getStatusColor({
                        id: tag.id,
                        shortId: tag.id,
                        lastSeen: tag.lastSeen,
                      } as DiscoveredTag)
                    : "red";

                  return (
                    <Box key={tag.id} flexDirection="row">
                      <Text>
                        <Text color={statusColor}>●</Text> {tag.id.padEnd(10)}{" "}
                        {tag.name.substring(0, 15).padEnd(15)} ({lastSeenText})
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Error */}
            {status.lastError && (
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="red"
                paddingX={1}
              >
                <Text bold color="red">
                  Latest Error
                </Text>
                <Text color="red">{status.lastError}</Text>
              </Box>
            )}
          </Box>

          {/* Right Column */}
          <Box flexDirection="column" width="40%" paddingLeft={1}>
            {/* Actions */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="cyan"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Actions --
              </Text>
              <Text>1-9 Set nickname for tag number</Text>
              <Text>S Save configuration to config.json</Text>
              <Text>Q Quit and save</Text>
              <Text>R Refresh display</Text>
            </Box>

            {/* Instructions */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="magenta"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Instructions --
              </Text>
              <Text>1. Wait for RuuviTags to be discovered</Text>
              <Text>2. Press number keys (1-9) to set nicknames</Text>
              <Text>3. Press 'S' to save to config.json</Text>
              <Text>4. Press 'Q' when finished</Text>
            </Box>

            {/* About */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="gray"
              paddingX={1}
            >
              <Text bold color="blue">
                -- About --
              </Text>
              <Text>This tool helps you:</Text>
              <Text>• Discover nearby RuuviTag sensors</Text>
              <Text>• Assign friendly nicknames</Text>
              <Text>• Update config.json automatically</Text>
              <Text>• Set display order for TRMNL</Text>
            </Box>

            {/* Tips */}
            {status.discoveredTags.size > 0 && (
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="yellow"
                paddingX={1}
              >
                <Text bold color="blue">
                  -- Tips --
                </Text>
                <Text>• Choose descriptive names like 'Kitchen',</Text>
                <Text> 'Bedroom', 'Outdoor'</Text>
                <Text>• Names will appear on your TRMNL display</Text>
                <Text>• You can change names anytime by</Text>
                <Text> running this tool again</Text>
              </Box>
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box
          justifyContent="center"
          marginTop={1}
          borderStyle="single"
          borderTop
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
        >
          <Text dimColor>
            Press 1-9 to set nickname • S to save • Q to quit • Ctrl+C to exit
          </Text>
        </Box>
      </Box>
    );
  }

  return SetupUI;
}
