import React from "react";
import type { AppStatus } from "@/ui/ink-combined-display";

export async function createDashboard(ink: any) {
  const { Box, Text, useInput, useApp } = ink;

  function Dashboard({
    status,
    onForceSend,
  }: {
    status: AppStatus;
    onForceSend?: () => void;
  }) {
    const { exit } = useApp();

    useInput((input: string, key: any) => {
      if (input === " " && onForceSend) {
        onForceSend();
      }
      if (key.ctrl && input === "c") {
        exit();
      }
    });

    const formatDateTime = (date: Date): string => {
      const yy = date.getFullYear().toString().slice(-2);
      const MM = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      return `${yy}-${MM}-${dd} ${hh}:${mm}`;
    };

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

    const getDataAge = (lastUpdated: string): string => {
      const age = Math.floor(
        (Date.now() - new Date(lastUpdated).getTime()) / 1000
      );

      if (age < 60) {
        return `${age}s ago`;
      } else if (age < 3600) {
        return `${Math.floor(age / 60)}m ago`;
      } else {
        return `${Math.floor(age / 3600)}h ago`;
      }
    };

    const getStatusColorFromAge = (
      lastUpdated: string
    ): "green" | "yellow" | "red" => {
      const age = Math.floor(
        (Date.now() - new Date(lastUpdated).getTime()) / 1000
      );

      // Fresh data (< 1 minute)
      if (age < 60) {
        return "green";
      }
      // Recent data (< 5 minutes)
      else if (age < 300) {
        return "yellow";
      }
      // Old data (> 5 minutes)
      else {
        return "red";
      }
    };

    const getStatusColor = (
      tagStatus: string
    ): "green" | "yellow" | "red" | "gray" => {
      switch (tagStatus) {
        case "active":
          return "green";
        case "stale":
          return "yellow";
        case "offline":
          return "red";
        default:
          return "gray";
      }
    };

    const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);

    const timeUntilNext = status.nextSendTime
      ? Math.max(
          0,
          Math.floor((status.nextSendTime.getTime() - Date.now()) / 1000)
        )
      : undefined;

    const maskWebhook = (url: string): string => {
      const parts = url.split("/");
      if (parts.length > 0) {
        const prefix = parts.slice(0, -1).join("/");
        return `${prefix}/***`;
      }
      return url;
    };

    return (
      <Box flexDirection="column" padding={1}>
        {/* Header */}
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">
            --- RuuviTRMNL Dashboard ---
          </Text>
        </Box>

        <Box flexDirection="row" marginBottom={1}>
          {/* Left Column - Compact Status */}
          <Box flexDirection="column" width="50%" paddingRight={1}>
            {/* Combined Status Box */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="blue"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Status --
              </Text>

              {/* App Status */}
              <Text>
                App: {status.isRunning ? "🟢 Active" : "🔴 Stopped"} | Uptime:{" "}
                {formatDuration(uptime)}
              </Text>

              {/* Scanner Status */}
              {status.scannerStatus && (
                <Text>
                  Scanner:{" "}
                  {status.scannerStatus.running ? "🟢 Active" : "🔴 Stopped"}
                  {status.scannerStatus.restarts
                    ? ` (${status.scannerStatus.restarts} restarts)`
                    : ""}
                </Text>
              )}

              {/* TRMNL Status */}
              <Text>
                TRMNL: {status.trmnlStats.totalSent} sent
                {status.rateLimitedUntil ? " | 🔴 Rate limited" : " | 🟢 OK"}
              </Text>

              {/* Statistics */}
              <Text>
                Tags: {status.collectorStats.totalDiscovered} discovered,{" "}
                {status.collectorStats.activeCount} active
              </Text>

              {/* Last Error */}
              {(status.scannerStatus?.lastError ||
                status.trmnlStats.lastResponseMessage) && (
                <Text color="red">
                  Error:{" "}
                  {status.scannerStatus?.lastError ||
                    status.trmnlStats.lastResponseMessage}
                </Text>
              )}
            </Box>

            {/* Sensor Readings - Compact */}
            {status.tags && status.tags.length > 0 && (
              <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="green"
                paddingX={1}
              >
                <Text bold color="blue">
                  -- Latest Readings --
                </Text>
                {status.tags.slice(0, 4).map((tag: any) => {
                  const temp =
                    tag.temperature !== undefined
                      ? `${tag.temperature.toFixed(1)}°C`
                      : "N/A";
                  const humidity =
                    tag.humidity !== undefined
                      ? `${tag.humidity.toFixed(0)}%`
                      : "N/A";
                  const age = getDataAge(tag.lastUpdated);
                  const statusColor = getStatusColorFromAge(tag.lastUpdated);

                  return (
                    <Text key={tag.id}>
                      <Text color={statusColor}>●</Text> {tag.name || tag.id}:{" "}
                      {temp}, {humidity} ({age})
                    </Text>
                  );
                })}
                {status.tags.length > 4 && (
                  <Text color="gray">
                    ... and {status.tags.length - 4} more
                  </Text>
                )}
              </Box>
            )}
          </Box>

          {/* Right Column - Compact TRMNL Data */}
          <Box
            flexDirection="column"
            width="45%"
            paddingLeft={1}
            borderStyle="round"
            borderColor="magenta"
            paddingX={1}
          >
            <Text bold color="green">
              -- TRMNL Status --
            </Text>
            {status.lastSentData ? (
              <Box flexDirection="column">
                <Text>Last Sent: {formatDateTime(status.lastSentTime!)}</Text>
                <Text>Tags: {status.lastSentData.tags?.length || 0}</Text>
                <Text>
                  Size: {JSON.stringify(status.lastSentData).length} chars
                </Text>
                {status.trmnlStats.lastResponseCode && (
                  <Text
                    color={
                      status.trmnlStats.lastResponseCode < 400 ? "green" : "red"
                    }
                  >
                    Response: HTTP {status.trmnlStats.lastResponseCode}
                  </Text>
                )}
              </Box>
            ) : (
              <Box flexDirection="column">
                <Text dimColor>No data sent yet</Text>
                <Text> </Text>
                <Text dimColor>Press SPACE to send current</Text>
                <Text dimColor>sensor data to TRMNL</Text>
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
          <Text dimColor>Press SPACE to force send • Ctrl+C to stop</Text>
        </Box>
      </Box>
    );
  }

  return Dashboard;
}
