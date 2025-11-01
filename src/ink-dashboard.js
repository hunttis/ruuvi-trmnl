const React = require('react');

async function createDashboard(ink) {
  const { Box, Text, useInput, useApp } = ink;

  function Dashboard({ status, onForceSend }) {
    const { exit } = useApp();

    useInput((input, key) => {
      if (input === ' ' && onForceSend) {
        onForceSend();
      }
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const formatDuration = (seconds) => {
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

  const getDataAge = (lastUpdated) => {
    const age = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);

    if (age < 60) {
      return `${age}s ago`;
    } else if (age < 3600) {
      return `${Math.floor(age / 60)}m ago`;
    } else {
      return `${Math.floor(age / 3600)}h ago`;
    }
  };

  const getStatusIcon = (tagStatus) => {
    switch (tagStatus) {
      case 'active':
        return '🟢';
      case 'stale':
        return '🟡';
      case 'offline':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);

  const timeUntilNext = status.nextSendTime
    ? Math.max(0, Math.floor((status.nextSendTime.getTime() - Date.now()) / 1000))
    : undefined;

  const maskWebhook = (url) => {
    const parts = url.split('/');
    if (parts.length > 0) {
      const prefix = parts.slice(0, -1).join('/');
      return `${prefix}/***`;
    }
    return url;
  };

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    // Header
    React.createElement(
      Box,
      { justifyContent: 'center', marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, '🏷️  RuuviTRMNL Dashboard')
    ),
    // Main content
    React.createElement(
      Box,
      { flexDirection: 'row', marginBottom: 1 },
      // Left Column
      React.createElement(
        Box,
        { flexDirection: 'column', width: '60%', paddingRight: 2 },
        // Application Status
        React.createElement(
          Box,
          { flexDirection: 'column', marginBottom: 1 },
          React.createElement(Text, { bold: true, color: 'blue' }, '📊 Application Status'),
          React.createElement(
            Text,
            null,
            '   Running: ',
            status.isRunning
              ? React.createElement(Text, { color: 'green' }, '✅ Active')
              : React.createElement(Text, { color: 'red' }, '❌ Stopped')
          ),
          React.createElement(Text, null, `   Started: ${status.startTime.toLocaleString()}`),
          status.lastUpdateTime &&
            React.createElement(
              Text,
              null,
              `   Last Update: ${status.lastUpdateTime.toLocaleTimeString()}`
            ),
          React.createElement(Text, null, `   Uptime: ${formatDuration(uptime)}`)
        ),
        // TRMNL Connection
        React.createElement(
          Box,
          { flexDirection: 'column', marginBottom: 1 },
          React.createElement(Text, { bold: true, color: 'blue' }, '🔗 TRMNL Connection'),
          React.createElement(Text, null, `   Webhook: ${maskWebhook(status.webhookInfo.url)}`),
          React.createElement(Text, null, `   Strategy: ${status.webhookInfo.strategy}`),
          React.createElement(Text, null, `   Total Updates Sent: ${status.trmnlStats.totalSent}`),
          status.lastSentTime &&
            React.createElement(
              Text,
              null,
              `   Last Sent to TRMNL: ${status.lastSentTime.toLocaleTimeString()}`
            ),
          timeUntilNext !== undefined &&
            React.createElement(
              Text,
              null,
              `   Next Send Available: ${timeUntilNext > 0 ? formatDuration(timeUntilNext) : 'Now'}`
            ),
          status.rateLimitedUntil &&
            status.rateLimitRemainingMinutes !== undefined &&
            React.createElement(
              Text,
              { color: 'red' },
              `   🚫 Rate Limited: ${status.rateLimitRemainingMinutes.toFixed(1)} min remaining`
            ),
          status.trmnlStats.lastResponseCode !== undefined &&
            React.createElement(
              Text,
              { color: status.trmnlStats.lastResponseCode < 400 ? 'green' : 'red' },
              `   Last Response: ${status.trmnlStats.lastResponseCode < 400 ? '✅' : '❌'} HTTP ${
                status.trmnlStats.lastResponseCode
              }`
            ),
          status.trmnlStats.lastResponseMessage &&
            React.createElement(Text, null, `   Response Message: ${status.trmnlStats.lastResponseMessage}`)
        ),
        // Statistics
        React.createElement(
          Box,
          { flexDirection: 'column', marginBottom: 1 },
          React.createElement(Text, { bold: true, color: 'blue' }, '📈 Statistics'),
          React.createElement(Text, null, `   Discovered Tags: ${status.collectorStats.totalDiscovered}`),
          React.createElement(Text, null, `   Active Tags: ${status.collectorStats.activeCount}`),
          React.createElement(Text, null, `   Stale Tags: ${status.collectorStats.staleCount}`),
          React.createElement(Text, null, `   Configured Tags: ${status.cacheStats.allowedTags}`),
          React.createElement(Text, null, `   Pending Changes: ${status.cacheStats.pendingSend}`)
        ),
        // Sensor Readings
        status.tags &&
          status.tags.length > 0 &&
          React.createElement(
            Box,
            { flexDirection: 'column', marginBottom: 1 },
            React.createElement(Text, { bold: true, color: 'blue' }, '🌡  Sensor Readings'),
            ...status.tags.map((tag) => {
              const temp = tag.temperature !== undefined ? `${tag.temperature.toFixed(1)}°C` : 'N/A';
              const humidity = tag.humidity !== undefined ? `${tag.humidity.toFixed(0)}%` : 'N/A';
              const battery = tag.battery !== undefined ? `${tag.battery.toFixed(2)}V` : 'N/A';
              const age = getDataAge(tag.lastUpdated);
              const statusIcon = getStatusIcon(tag.status);

              return React.createElement(
                Text,
                { key: tag.id },
                `   ${statusIcon} ${tag.name.padEnd(12)} ${temp.padStart(7)} ${humidity.padStart(
                  5
                )} ${battery.padStart(6)} (${age})`
              );
            })
          ),
        // Error
        status.lastError &&
          React.createElement(
            Box,
            { flexDirection: 'column' },
            React.createElement(Text, { bold: true, color: 'red' }, '❌ Latest Error'),
            React.createElement(Text, { color: 'red' }, `   ${status.lastError}`)
          )
      ),
      // Right Column
      React.createElement(
        Box,
        {
          flexDirection: 'column',
          width: '40%',
          paddingLeft: 2,
          borderStyle: 'single',
          borderLeft: true,
          borderRight: false,
          borderTop: false,
          borderBottom: false,
        },
        React.createElement(Text, { bold: true, color: 'blue' }, '📤 Latest TRMNL Data'),
        React.createElement(Text, null, ' '),
        status.lastSentData
          ? React.createElement(
              Box,
              { flexDirection: 'column' },
              React.createElement(Text, { dimColor: true }, JSON.stringify(status.lastSentData, null, 2))
            )
          : React.createElement(
              Box,
              { flexDirection: 'column' },
              React.createElement(Text, { dimColor: true }, '   No data sent yet'),
              React.createElement(Text, null, ' '),
              React.createElement(Text, { dimColor: true }, '   Press SPACE to send current'),
              React.createElement(Text, { dimColor: true }, '   sensor data to TRMNL')
            )
      )
    ),
    // Footer
    React.createElement(
      Box,
      {
        justifyContent: 'center',
        marginTop: 1,
        borderStyle: 'single',
        borderTop: true,
        borderBottom: false,
        borderLeft: false,
        borderRight: false,
      },
      React.createElement(Text, { dimColor: true }, 'Press SPACE to force send • Ctrl+C to stop')
    )
  );
}

  return Dashboard;
}

module.exports = { createDashboard };
