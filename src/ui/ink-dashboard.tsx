import React from "react";
import type { AppStatus } from "@/ui/ink-display";

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
          {/* Left Column */}
          <Box flexDirection="column" width="60%" paddingRight={1}>
            {/* Application Status */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="blue"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Application Status --
              </Text>
              <Text>
                Running:{" "}
                {status.isRunning ? (
                  <Text color="green">Active</Text>
                ) : (
                  <Text color="red">Stopped</Text>
                )}
              </Text>
              <Text>Started: {formatDateTime(status.startTime)}</Text>
              {status.lastUpdateTime && (
                <Text>
                  Last Update: {formatDateTime(status.lastUpdateTime)}
                </Text>
              )}
              <Text>Uptime: {formatDuration(uptime)}</Text>
            </Box>

            {/* TRMNL Connection */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="cyan"
              paddingX={1}
            >
              <Text bold color="blue">
                -- TRMNL Connection --
              </Text>
              <Text>Webhook: {maskWebhook(status.webhookInfo.url)}</Text>
              <Text>Strategy: {status.webhookInfo.strategy}</Text>
              <Text>Total Updates Sent: {status.trmnlStats.totalSent}</Text>
              {status.lastSentTime && (
                <Text>Last Sent: {formatDateTime(status.lastSentTime)}</Text>
              )}
              {timeUntilNext !== undefined && (
                <Text>
                  Next Send:{" "}
                  {timeUntilNext > 0 ? formatDuration(timeUntilNext) : "Now"}
                </Text>
              )}
              {status.rateLimitedUntil &&
                status.rateLimitRemainingMinutes !== undefined && (
                  <Text color="red">
                    Rate Limited: {status.rateLimitRemainingMinutes.toFixed(1)}{" "}
                    min remaining
                  </Text>
                )}
              {status.trmnlStats.lastResponseCode !== undefined && (
                <Text
                  color={
                    status.trmnlStats.lastResponseCode < 400 ? "green" : "red"
                  }
                >
                  Last Response: HTTP {status.trmnlStats.lastResponseCode}
                </Text>
              )}
              {status.trmnlStats.lastResponseMessage && (
                <Text>Message: {status.trmnlStats.lastResponseMessage}</Text>
              )}
            </Box>

            {/* Statistics */}
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="green"
              paddingX={1}
            >
              <Text bold color="blue">
                -- Statistics --
              </Text>
              <Text>
                Discovered Tags: {status.collectorStats.totalDiscovered}
              </Text>
              <Text>Active Tags: {status.collectorStats.activeCount}</Text>
              <Text>Stale Tags: {status.collectorStats.staleCount}</Text>
              <Text>Configured Tags: {status.cacheStats.allowedTags}</Text>
              <Text>Pending Changes: {status.cacheStats.pendingSend}</Text>
            </Box>

            {/* Sensor Readings */}
            {status.tags && status.tags.length > 0 && (
              <Box
                flexDirection="column"
                marginBottom={1}
                borderStyle="round"
                borderColor="yellow"
                paddingX={1}
              >
                <Text bold color="blue">
                  -- Sensor Readings --
                </Text>
                {status.tags.map((tag: any) => {
                  const temp =
                    tag.temperature !== undefined
                      ? `${tag.temperature.toFixed(1)}°C`
                      : "N/A";
                  const humidity =
                    tag.humidity !== undefined
                      ? `${tag.humidity.toFixed(0)}%`
                      : "N/A";
                  const battery =
                    tag.battery !== undefined
                      ? `${tag.battery.toFixed(2)}V`
                      : "N/A";
                  const age = getDataAge(tag.lastUpdated);
                  const statusColor = getStatusColor(tag.status);

                  return (
                    <Text key={tag.id}>
                      <Text color={statusColor}>●</Text> {tag.name.padEnd(12)}{" "}
                      {temp.padStart(7)} {humidity.padStart(5)}{" "}
                      {battery.padStart(6)} ({age})
                    </Text>
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
          <Box
            flexDirection="column"
            width="40%"
            paddingLeft={1}
            borderStyle="round"
            borderColor="magenta"
            paddingX={1}
          >
            <Text bold color="green">
              -- Latest TRMNL Data --
            </Text>
            {status.lastSentData ? (
              <Box flexDirection="column">
                <Text dimColor>
                  {JSON.stringify(status.lastSentData, null, 2)}
                </Text>
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
