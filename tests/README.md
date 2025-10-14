# RuuviTRMNL Test Suite

This directory contains comprehensive unit tests for the RuuviTRMNL application.

## Test Structure

```
tests/
├── config.test.ts         # ConfigManager tests
├── trmnl-sender.test.ts   # TrmnlWebhookSender tests
├── ruuvi-collector.test.ts # RuuviCollector tests
├── app.test.ts            # Main application tests
└── setup.ts               # Test setup and mocks
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The test suite covers:

### ConfigManager (`config.test.ts`)

- ✅ Configuration file loading
- ✅ Error handling for missing/invalid configs
- ✅ Webhook URL validation
- ✅ Tag alias resolution (MAC addresses, shortened IDs)
- ✅ Caching behavior

### TrmnlWebhookSender (`trmnl-sender.test.ts`)

- ✅ Successful data transmission
- ✅ HTTP error handling
- ✅ Network error handling
- ✅ Payload formatting and validation
- ✅ Merge strategy configuration
- ✅ Connection testing
- ✅ URL masking for security

### RuuviCollector (`ruuvi-collector.test.ts`)

- ✅ Initial state and statistics
- ✅ Active tag data retrieval
- ✅ Basic scanning control
- ✅ Snapshot functionality

### Main Application (`app.test.ts`)

- ✅ Application lifecycle (start/stop)
- ✅ Periodic data transmission
- ✅ Error handling and graceful shutdown
- ✅ Status reporting
- ✅ Data filtering (stale data removal)
- ✅ Connection testing integration

## Mocking Strategy

### External Dependencies

- **node-ruuvitag**: Mocked to simulate RuuviTag discovery and data
- **fetch**: Global mock for HTTP requests to TRMNL API
- **fs**: Mocked for configuration file operations
- **console**: Mocked to reduce test output noise

### Test Utilities

- **Jest fake timers**: Used for testing periodic intervals
- **Process signal handling**: Mocked to test graceful shutdown
- **AbortController**: Used for timeout testing

## Key Test Patterns

### Configuration Testing

```typescript
mockFs.existsSync.mockReturnValue(true);
mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
const config = configManager.loadConfig();
```

### HTTP Mocking

```typescript
mockFetch.mockResolvedValue({
  ok: true,
  status: 200,
  text: jest.fn().mockResolvedValue("{}"),
});
```

### Timer Testing

```typescript
jest.useFakeTimers();
jest.advanceTimersByTime(300000); // Simulate 5 minutes
```

## Coverage Goals

- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >95%
- **Lines**: >90%

## Known Limitations

1. **RuuviTag Integration**: Complex Bluetooth event handling is simplified in tests
2. **Timeout Testing**: AbortController timeout scenarios are challenging to test reliably
3. **Process Signals**: Real signal handling cannot be fully tested in Jest environment

## Test Data

### Mock RuuviTag Data

```typescript
const mockTagData = [
  {
    id: "a06bd66b",
    name: "Living Room",
    temperature: 22.6,
    humidity: 45.2,
    battery: 2.89,
    status: "active",
  },
];
```

### Mock Configuration

```typescript
const mockConfig = {
  trmnl: {
    webhookUrl: "https://usetrmnl.com/api/custom_plugins/test-id",
    refreshInterval: 300000,
    maxTagsToDisplay: 5,
    mergeStrategy: "replace",
    requestTimeout: 10000,
  },
  ruuvi: {
    scanTimeout: 5000,
    dataRetentionTime: 300000,
    tagAliases: {
      a06bd66b: "Living Room",
      "870d8621": "Outdoor",
    },
  },
};
```

## Continuous Integration

Tests are designed to run in CI environments with:

- No external dependencies (Bluetooth, network)
- Deterministic timing using fake timers
- Comprehensive mocking of hardware interfaces
- Clean setup/teardown for isolation
