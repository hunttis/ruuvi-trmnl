async function createDashboard(ink) {const React = require('react');const React = require('react');

  const React = require('react');

  const { Box, Text, useInput, useApp } = ink;



  function Dashboard({ status, onForceSend }) {async function createDashboard(ink) {async function createDashboard(ink) {

    const { exit } = useApp();

  const { Box, Text, useInput, useApp } = ink;  const { Box, Text, useInput, useApp } = ink;

    useInput((input, key) => {

      if (input === ' ' && onForceSend) {

        onForceSend();

      }  function Dashboard({ status, onForceSend }) {  function Dashboard({ status, onForceSend }) {

      if (key.ctrl && input === 'c') {

        exit();    const { exit } = useApp();    const { exit } = useApp();

      }

    });



    const formatDuration = (seconds) => {    useInput((input, key) => {    useInput((input, key) => {

      const hours = Math.floor(seconds / 3600);

      const minutes = Math.floor((seconds % 3600) / 60);      if (input === ' ' && onForceSend) {      if (input === ' ' && onForceSend) {

      const secs = seconds % 60;

        onForceSend();        onForceSend();

      if (hours > 0) {

        return `${hours}h ${minutes}m ${secs}s`;      }      }

      } else if (minutes > 0) {

        return `${minutes}m ${secs}s`;      if (key.ctrl && input === 'c') {    if (key.ctrl && input === 'c') {

      } else {

        return `${secs}s`;        exit();      exit();

      }

    };      }    }



    const getDataAge = (lastUpdated) => {    });  });

      const age = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);



      if (age < 60) {

        return `${age}s ago`;    const formatDuration = (seconds) => {  const formatDuration = (seconds) => {

      } else if (age < 3600) {

        return `${Math.floor(age / 60)}m ago`;      const hours = Math.floor(seconds / 3600);    const hours = Math.floor(seconds / 3600);

      } else {

        return `${Math.floor(age / 3600)}h ago`;      const minutes = Math.floor((seconds % 3600) / 60);    const minutes = Math.floor((seconds % 3600) / 60);

      }

    };      const secs = seconds % 60;    const secs = seconds % 60;



    const getStatusIcon = (tagStatus) => {

      switch (tagStatus) {

        case 'active':      if (hours > 0) {    if (hours > 0) {

          return '🟢';

        case 'stale':        return `${hours}h ${minutes}m ${secs}s`;      return `${hours}h ${minutes}m ${secs}s`;

          return '🟡';

        case 'offline':      } else if (minutes > 0) {    } else if (minutes > 0) {

          return '🔴';

        default:        return `${minutes}m ${secs}s`;      return `${minutes}m ${secs}s`;

          return '⚪';

      }      } else {    } else {

    };

        return `${secs}s`;      return `${secs}s`;

    const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);

      }    }

    const timeUntilNext = status.nextSendTime

      ? Math.max(0, Math.floor((status.nextSendTime.getTime() - Date.now()) / 1000))    };  };

      : undefined;



    const maskWebhook = (url) => {

      const parts = url.split('/');    const getDataAge = (lastUpdated) => {  const getDataAge = (lastUpdated) => {

      if (parts.length > 0) {

        const prefix = parts.slice(0, -1).join('/');      const age = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);    const age = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 1000);

        return `${prefix}/***`;

      }

      return url;

    };      if (age < 60) {    if (age < 60) {



    return (        return `${age}s ago`;      return `${age}s ago`;

      <Box flexDirection="column" padding={1}>

        {/* Header */}      } else if (age < 3600) {    } else if (age < 3600) {

        <Box justifyContent="center" marginBottom={1}>

          <Text bold color="cyan">        return `${Math.floor(age / 60)}m ago`;      return `${Math.floor(age / 60)}m ago`;

            🏷️  RuuviTRMNL Dashboard

          </Text>      } else {    } else {

        </Box>

        return `${Math.floor(age / 3600)}h ago`;      return `${Math.floor(age / 3600)}h ago`;

        <Box flexDirection="row" marginBottom={1}>

          {/* Left Column */}      }    }

          <Box flexDirection="column" width="60%" paddingRight={2}>

            {/* Application Status */}    };  };

            <Box flexDirection="column" marginBottom={1}>

              <Text bold color="blue">

                📊 Application Status

              </Text>    const getStatusIcon = (tagStatus) => {  const getStatusIcon = (tagStatus) => {

              <Text>

                {'   '}Running:{' '}      switch (tagStatus) {    switch (tagStatus) {

                {status.isRunning ? (

                  <Text color="green">✅ Active</Text>        case 'active':      case 'active':

                ) : (

                  <Text color="red">❌ Stopped</Text>          return '🟢';        return '🟢';

                )}

              </Text>        case 'stale':      case 'stale':

              <Text>{'   '}Started: {status.startTime.toLocaleString()}</Text>

              {status.lastUpdateTime && (          return '🟡';        return '🟡';

                <Text>{'   '}Last Update: {status.lastUpdateTime.toLocaleTimeString()}</Text>

              )}        case 'offline':      case 'offline':

              <Text>{'   '}Uptime: {formatDuration(uptime)}</Text>

            </Box>          return '🔴';        return '🔴';



            {/* TRMNL Connection */}        default:      default:

            <Box flexDirection="column" marginBottom={1}>

              <Text bold color="blue">          return '⚪';        return '⚪';

                🔗 TRMNL Connection

              </Text>      }    }

              <Text>{'   '}Webhook: {maskWebhook(status.webhookInfo.url)}</Text>

              <Text>{'   '}Strategy: {status.webhookInfo.strategy}</Text>    };  };

              <Text>{'   '}Total Updates Sent: {status.trmnlStats.totalSent}</Text>

              {status.lastSentTime && (

                <Text>{'   '}Last Sent to TRMNL: {status.lastSentTime.toLocaleTimeString()}</Text>

              )}    const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);  const uptime = Math.floor((Date.now() - status.startTime.getTime()) / 1000);

              {timeUntilNext !== undefined && (

                <Text>

                  {'   '}Next Send Available: {timeUntilNext > 0 ? formatDuration(timeUntilNext) : 'Now'}

                </Text>    const timeUntilNext = status.nextSendTime  const timeUntilNext = status.nextSendTime

              )}

              {status.rateLimitedUntil && status.rateLimitRemainingMinutes !== undefined && (      ? Math.max(0, Math.floor((status.nextSendTime.getTime() - Date.now()) / 1000))    ? Math.max(0, Math.floor((status.nextSendTime.getTime() - Date.now()) / 1000))

                <Text color="red">

                  {'   '}🚫 Rate Limited: {status.rateLimitRemainingMinutes.toFixed(1)} min remaining      : undefined;    : undefined;

                </Text>

              )}

              {status.trmnlStats.lastResponseCode !== undefined && (

                <Text color={status.trmnlStats.lastResponseCode < 400 ? 'green' : 'red'}>    const maskWebhook = (url) => {  const maskWebhook = (url) => {

                  {'   '}Last Response: {status.trmnlStats.lastResponseCode < 400 ? '✅' : '❌'} HTTP{' '}

                  {status.trmnlStats.lastResponseCode}      const parts = url.split('/');    const parts = url.split('/');

                </Text>

              )}      if (parts.length > 0) {    if (parts.length > 0) {

              {status.trmnlStats.lastResponseMessage && (

                <Text>{'   '}Response Message: {status.trmnlStats.lastResponseMessage}</Text>        const prefix = parts.slice(0, -1).join('/');      const prefix = parts.slice(0, -1).join('/');

              )}

            </Box>        return `${prefix}/***`;      return `${prefix}/***`;



            {/* Statistics */}      }    }

            <Box flexDirection="column" marginBottom={1}>

              <Text bold color="blue">      return url;    return url;

                📈 Statistics

              </Text>    };  };

              <Text>{'   '}Discovered Tags: {status.collectorStats.totalDiscovered}</Text>

              <Text>{'   '}Active Tags: {status.collectorStats.activeCount}</Text>

              <Text>{'   '}Stale Tags: {status.collectorStats.staleCount}</Text>

              <Text>{'   '}Configured Tags: {status.cacheStats.allowedTags}</Text>    return (  return React.createElement(

              <Text>{'   '}Pending Changes: {status.cacheStats.pendingSend}</Text>

            </Box>      <Box flexDirection="column" padding={1}>    Box,



            {/* Sensor Readings */}        {/* Header */}    { flexDirection: 'column', padding: 1 },

            {status.tags && status.tags.length > 0 && (

              <Box flexDirection="column" marginBottom={1}>        <Box justifyContent="center" marginBottom={1}>    // Header

                <Text bold color="blue">

                  🌡  Sensor Readings          <Text bold color="cyan">    React.createElement(

                </Text>

                {status.tags.map((tag) => {            🏷️  RuuviTRMNL Dashboard      Box,

                  const temp = tag.temperature !== undefined ? `${tag.temperature.toFixed(1)}°C` : 'N/A';

                  const humidity = tag.humidity !== undefined ? `${tag.humidity.toFixed(0)}%` : 'N/A';          </Text>      { justifyContent: 'center', marginBottom: 1 },

                  const battery = tag.battery !== undefined ? `${tag.battery.toFixed(2)}V` : 'N/A';

                  const age = getDataAge(tag.lastUpdated);        </Box>      React.createElement(Text, { bold: true, color: 'cyan' }, '🏷️  RuuviTRMNL Dashboard')

                  const statusIcon = getStatusIcon(tag.status);

    ),

                  return (

                    <Text key={tag.id}>        <Box flexDirection="row" marginBottom={1}>    // Main content

                      {'   '}

                      {statusIcon} {tag.name.padEnd(12)} {temp.padStart(7)} {humidity.padStart(5)}{' '}          {/* Left Column */}    React.createElement(

                      {battery.padStart(6)} ({age})

                    </Text>          <Box flexDirection="column" width="60%" paddingRight={2}>      Box,

                  );

                })}            {/* Application Status */}      { flexDirection: 'row', marginBottom: 1 },

              </Box>

            )}            <Box flexDirection="column" marginBottom={1}>      // Left Column



            {/* Error */}              <Text bold color="blue">      React.createElement(

            {status.lastError && (

              <Box flexDirection="column">                📊 Application Status        Box,

                <Text bold color="red">

                  ❌ Latest Error              </Text>        { flexDirection: 'column', width: '60%', paddingRight: 2 },

                </Text>

                <Text color="red">{'   '}{status.lastError}</Text>              <Text>        // Application Status

              </Box>

            )}                {'   '}Running:{' '}        React.createElement(

          </Box>

                {status.isRunning ? (          Box,

          {/* Right Column */}

          <Box                  <Text color="green">✅ Active</Text>          { flexDirection: 'column', marginBottom: 1 },

            flexDirection="column"

            width="40%"                ) : (          React.createElement(Text, { bold: true, color: 'blue' }, '📊 Application Status'),

            paddingLeft={2}

            borderStyle="single"                  <Text color="red">❌ Stopped</Text>          React.createElement(

            borderLeft={true}

            borderRight={false}                )}            Text,

            borderTop={false}

            borderBottom={false}              </Text>            null,

          >

            <Text bold color="blue">              <Text>{'   '}Started: {status.startTime.toLocaleString()}</Text>            '   Running: ',

              📤 Latest TRMNL Data

            </Text>              {status.lastUpdateTime && (            status.isRunning

            <Text> </Text>

            {status.lastSentData ? (                <Text>{'   '}Last Update: {status.lastUpdateTime.toLocaleTimeString()}</Text>              ? React.createElement(Text, { color: 'green' }, '✅ Active')

              <Box flexDirection="column">

                <Text dimColor>{JSON.stringify(status.lastSentData, null, 2)}</Text>              )}              : React.createElement(Text, { color: 'red' }, '❌ Stopped')

              </Box>

            ) : (              <Text>{'   '}Uptime: {formatDuration(uptime)}</Text>          ),

              <Box flexDirection="column">

                <Text dimColor>{'   '}No data sent yet</Text>            </Box>          React.createElement(Text, null, `   Started: ${status.startTime.toLocaleString()}`),

                <Text> </Text>

                <Text dimColor>{'   '}Press SPACE to send current</Text>          status.lastUpdateTime &&

                <Text dimColor>{'   '}sensor data to TRMNL</Text>

              </Box>            {/* TRMNL Connection */}            React.createElement(

            )}

          </Box>            <Box flexDirection="column" marginBottom={1}>              Text,

        </Box>

              <Text bold color="blue">              null,

        {/* Footer */}

        <Box                🔗 TRMNL Connection              `   Last Update: ${status.lastUpdateTime.toLocaleTimeString()}`

          justifyContent="center"

          marginTop={1}              </Text>            ),

          borderStyle="single"

          borderTop={true}              <Text>{'   '}Webhook: {maskWebhook(status.webhookInfo.url)}</Text>          React.createElement(Text, null, `   Uptime: ${formatDuration(uptime)}`)

          borderBottom={false}

          borderLeft={false}              <Text>{'   '}Strategy: {status.webhookInfo.strategy}</Text>        ),

          borderRight={false}

        >              <Text>{'   '}Total Updates Sent: {status.trmnlStats.totalSent}</Text>        // TRMNL Connection

          <Text dimColor>Press SPACE to force send • Ctrl+C to stop</Text>

        </Box>              {status.lastSentTime && (        React.createElement(

      </Box>

    );                <Text>{'   '}Last Sent to TRMNL: {status.lastSentTime.toLocaleTimeString()}</Text>          Box,

  }

              )}          { flexDirection: 'column', marginBottom: 1 },

  return Dashboard;

}              {timeUntilNext !== undefined && (          React.createElement(Text, { bold: true, color: 'blue' }, '🔗 TRMNL Connection'),



module.exports = { createDashboard };                <Text>          React.createElement(Text, null, `   Webhook: ${maskWebhook(status.webhookInfo.url)}`),


                  {'   '}Next Send Available: {timeUntilNext > 0 ? formatDuration(timeUntilNext) : 'Now'}          React.createElement(Text, null, `   Strategy: ${status.webhookInfo.strategy}`),

                </Text>          React.createElement(Text, null, `   Total Updates Sent: ${status.trmnlStats.totalSent}`),

              )}          status.lastSentTime &&

              {status.rateLimitedUntil && status.rateLimitRemainingMinutes !== undefined && (            React.createElement(

                <Text color="red">              Text,

                  {'   '}🚫 Rate Limited: {status.rateLimitRemainingMinutes.toFixed(1)} min remaining              null,

                </Text>              `   Last Sent to TRMNL: ${status.lastSentTime.toLocaleTimeString()}`

              )}            ),

              {status.trmnlStats.lastResponseCode !== undefined && (          timeUntilNext !== undefined &&

                <Text color={status.trmnlStats.lastResponseCode < 400 ? 'green' : 'red'}>            React.createElement(

                  {'   '}Last Response: {status.trmnlStats.lastResponseCode < 400 ? '✅' : '❌'} HTTP{' '}              Text,

                  {status.trmnlStats.lastResponseCode}              null,

                </Text>              `   Next Send Available: ${timeUntilNext > 0 ? formatDuration(timeUntilNext) : 'Now'}`

              )}            ),

              {status.trmnlStats.lastResponseMessage && (          status.rateLimitedUntil &&

                <Text>{'   '}Response Message: {status.trmnlStats.lastResponseMessage}</Text>            status.rateLimitRemainingMinutes !== undefined &&

              )}            React.createElement(

            </Box>              Text,

              { color: 'red' },

            {/* Statistics */}              `   🚫 Rate Limited: ${status.rateLimitRemainingMinutes.toFixed(1)} min remaining`

            <Box flexDirection="column" marginBottom={1}>            ),

              <Text bold color="blue">          status.trmnlStats.lastResponseCode !== undefined &&

                📈 Statistics            React.createElement(

              </Text>              Text,

              <Text>{'   '}Discovered Tags: {status.collectorStats.totalDiscovered}</Text>              { color: status.trmnlStats.lastResponseCode < 400 ? 'green' : 'red' },

              <Text>{'   '}Active Tags: {status.collectorStats.activeCount}</Text>              `   Last Response: ${status.trmnlStats.lastResponseCode < 400 ? '✅' : '❌'} HTTP ${

              <Text>{'   '}Stale Tags: {status.collectorStats.staleCount}</Text>                status.trmnlStats.lastResponseCode

              <Text>{'   '}Configured Tags: {status.cacheStats.allowedTags}</Text>              }`

              <Text>{'   '}Pending Changes: {status.cacheStats.pendingSend}</Text>            ),

            </Box>          status.trmnlStats.lastResponseMessage &&

            React.createElement(Text, null, `   Response Message: ${status.trmnlStats.lastResponseMessage}`)

            {/* Sensor Readings */}        ),

            {status.tags && status.tags.length > 0 && (        // Statistics

              <Box flexDirection="column" marginBottom={1}>        React.createElement(

                <Text bold color="blue">          Box,

                  🌡  Sensor Readings          { flexDirection: 'column', marginBottom: 1 },

                </Text>          React.createElement(Text, { bold: true, color: 'blue' }, '📈 Statistics'),

                {status.tags.map((tag) => {          React.createElement(Text, null, `   Discovered Tags: ${status.collectorStats.totalDiscovered}`),

                  const temp = tag.temperature !== undefined ? `${tag.temperature.toFixed(1)}°C` : 'N/A';          React.createElement(Text, null, `   Active Tags: ${status.collectorStats.activeCount}`),

                  const humidity = tag.humidity !== undefined ? `${tag.humidity.toFixed(0)}%` : 'N/A';          React.createElement(Text, null, `   Stale Tags: ${status.collectorStats.staleCount}`),

                  const battery = tag.battery !== undefined ? `${tag.battery.toFixed(2)}V` : 'N/A';          React.createElement(Text, null, `   Configured Tags: ${status.cacheStats.allowedTags}`),

                  const age = getDataAge(tag.lastUpdated);          React.createElement(Text, null, `   Pending Changes: ${status.cacheStats.pendingSend}`)

                  const statusIcon = getStatusIcon(tag.status);        ),

        // Sensor Readings

                  return (        status.tags &&

                    <Text key={tag.id}>          status.tags.length > 0 &&

                      {'   '}          React.createElement(

                      {statusIcon} {tag.name.padEnd(12)} {temp.padStart(7)} {humidity.padStart(5)}{' '}            Box,

                      {battery.padStart(6)} ({age})            { flexDirection: 'column', marginBottom: 1 },

                    </Text>            React.createElement(Text, { bold: true, color: 'blue' }, '🌡  Sensor Readings'),

                  );            ...status.tags.map((tag) => {

                })}              const temp = tag.temperature !== undefined ? `${tag.temperature.toFixed(1)}°C` : 'N/A';

              </Box>              const humidity = tag.humidity !== undefined ? `${tag.humidity.toFixed(0)}%` : 'N/A';

            )}              const battery = tag.battery !== undefined ? `${tag.battery.toFixed(2)}V` : 'N/A';

              const age = getDataAge(tag.lastUpdated);

            {/* Error */}              const statusIcon = getStatusIcon(tag.status);

            {status.lastError && (

              <Box flexDirection="column">              return React.createElement(

                <Text bold color="red">                Text,

                  ❌ Latest Error                { key: tag.id },

                </Text>                `   ${statusIcon} ${tag.name.padEnd(12)} ${temp.padStart(7)} ${humidity.padStart(

                <Text color="red">{'   '}{status.lastError}</Text>                  5

              </Box>                )} ${battery.padStart(6)} (${age})`

            )}              );

          </Box>            })

          ),

          {/* Right Column */}        // Error

          <Box        status.lastError &&

            flexDirection="column"          React.createElement(

            width="40%"            Box,

            paddingLeft={2}            { flexDirection: 'column' },

            borderStyle="single"            React.createElement(Text, { bold: true, color: 'red' }, '❌ Latest Error'),

            borderLeft={true}            React.createElement(Text, { color: 'red' }, `   ${status.lastError}`)

            borderRight={false}          )

            borderTop={false}      ),

            borderBottom={false}      // Right Column

          >      React.createElement(

            <Text bold color="blue">        Box,

              📤 Latest TRMNL Data        {

            </Text>          flexDirection: 'column',

            <Text> </Text>          width: '40%',

            {status.lastSentData ? (          paddingLeft: 2,

              <Box flexDirection="column">          borderStyle: 'single',

                <Text dimColor>{JSON.stringify(status.lastSentData, null, 2)}</Text>          borderLeft: true,

              </Box>          borderRight: false,

            ) : (          borderTop: false,

              <Box flexDirection="column">          borderBottom: false,

                <Text dimColor>{'   '}No data sent yet</Text>        },

                <Text> </Text>        React.createElement(Text, { bold: true, color: 'blue' }, '📤 Latest TRMNL Data'),

                <Text dimColor>{'   '}Press SPACE to send current</Text>        React.createElement(Text, null, ' '),

                <Text dimColor>{'   '}sensor data to TRMNL</Text>        status.lastSentData

              </Box>          ? React.createElement(

            )}              Box,

          </Box>              { flexDirection: 'column' },

        </Box>              React.createElement(Text, { dimColor: true }, JSON.stringify(status.lastSentData, null, 2))

            )

        {/* Footer */}          : React.createElement(

        <Box              Box,

          justifyContent="center"              { flexDirection: 'column' },

          marginTop={1}              React.createElement(Text, { dimColor: true }, '   No data sent yet'),

          borderStyle="single"              React.createElement(Text, null, ' '),

          borderTop={true}              React.createElement(Text, { dimColor: true }, '   Press SPACE to send current'),

          borderBottom={false}              React.createElement(Text, { dimColor: true }, '   sensor data to TRMNL')

          borderLeft={false}            )

          borderRight={false}      )

        >    ),

          <Text dimColor>Press SPACE to force send • Ctrl+C to stop</Text>    // Footer

        </Box>    React.createElement(

      </Box>      Box,

    );      {

  }        justifyContent: 'center',

        marginTop: 1,

  return Dashboard;        borderStyle: 'single',

}        borderTop: true,

        borderBottom: false,

module.exports = { createDashboard };        borderLeft: false,

        borderRight: false,
      },
      React.createElement(Text, { dimColor: true }, 'Press SPACE to force send • Ctrl+C to stop')
    )
  );
}

  return Dashboard;
}

module.exports = { createDashboard };
