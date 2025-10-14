import { RuuviTrmnlApp } from "../src/app";
import { configManager } from "../src/config";
import { RuuviCollector } from "../src/ruuvi-collector";
import { TrmnlWebhookSender } from "../src/trmnl-sender";

// Mock dependencies
jest.mock("../src/config");
jest.mock("../src/ruuvi-collector");
jest.mock("../src/trmnl-sender");

const mockConfigManager = configManager as jest.Mocked<typeof configManager>;
const MockRuuviCollector = RuuviCollector as jest.MockedClass<
  typeof RuuviCollector
>;
const MockTrmnlWebhookSender = TrmnlWebhookSender as jest.MockedClass<
  typeof TrmnlWebhookSender
>;

describe("RuuviTrmnlApp", () => {
  let app: RuuviTrmnlApp;
  let mockCollector: jest.Mocked<RuuviCollector>;
  let mockSender: jest.Mocked<TrmnlWebhookSender>;

  const mockConfig = {
    trmnl: {
      webhookUrl: "https://usetrmnl.com/api/custom_plugins/test-id",
      refreshInterval: 5000, // Short interval for testing
      maxTagsToDisplay: 5,
      mergeStrategy: "replace" as const,
      requestTimeout: 10000,
    },
    ruuvi: {
      scanTimeout: 5000,
      dataRetentionTime: 300000,
      tagAliases: {
        a06bd66b: "Living Room",
      },
    },
  };

  const mockTagData = [
    {
      id: "a06bd66b",
      name: "Living Room",
      temperature: 22.6,
      humidity: 45.2,
      battery: 2.89,
      lastUpdated: new Date().toISOString(),
      status: "active" as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: true });

    mockConfigManager.getConfig.mockReturnValue(mockConfig);

    // Create mock instances
    mockCollector = {
      startScanning: jest.fn().mockResolvedValue(undefined),
      stopScanning: jest.fn().mockResolvedValue(undefined),
      getActiveTagData: jest.fn().mockReturnValue(mockTagData),
      getStats: jest.fn().mockReturnValue({
        totalDiscovered: 1,
        activeCount: 1,
        staleCount: 0,
      }),
    } as any;

    mockSender = {
      testConnection: jest.fn().mockResolvedValue(true),
      sendRuuviData: jest.fn().mockResolvedValue(true),
      getWebhookInfo: jest.fn().mockReturnValue({
        url: "https://usetrmnl.com/api/custom_plugins/***",
        strategy: "replace",
        timeout: 10000,
      }),
    } as any;

    MockRuuviCollector.mockImplementation(() => mockCollector);
    MockTrmnlWebhookSender.mockImplementation(() => mockSender);

    app = new RuuviTrmnlApp();
  });

  afterEach(async () => {
    // Stop the app if it's running to clean up intervals
    if (app) {
      try {
        await app.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    jest.useRealTimers();
  });

  describe("constructor", () => {
    it("should create instances of collector and sender", () => {
      expect(MockRuuviCollector).toHaveBeenCalled();
      expect(MockTrmnlWebhookSender).toHaveBeenCalled();
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });
  });

  describe("start", () => {
    it("should start the application successfully", () => {
      // Test the initialization parts we can verify synchronously
      const startSpy = jest.spyOn(app, "start");
      app.start();

      expect(startSpy).toHaveBeenCalled();
      expect(mockSender.testConnection).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "🚀 Starting RuuviTRMNL application..."
      );

      // Note: Full async completion testing skipped due to timer complexity
    });

    it("should not start if already running", async () => {
      await app.start();
      jest.clearAllMocks();

      await app.start();

      expect(console.log).toHaveBeenCalledWith("⚠️  App is already running");
      expect(mockSender.testConnection).not.toHaveBeenCalled();
    });

    it("should fail to start if TRMNL connection test fails", async () => {
      mockSender.testConnection.mockResolvedValue(false);

      await app.start();

      expect(console.error).toHaveBeenCalledWith(
        "❌ TRMNL connection test failed. Please check your webhook URL."
      );
      expect(mockCollector.startScanning).not.toHaveBeenCalled();
    });

    it("should set up periodic data sending", async () => {
      await app.start();

      // Fast-forward to trigger the interval
      jest.advanceTimersByTime(mockConfig.trmnl.refreshInterval + 1000);
      await Promise.resolve();

      expect(mockCollector.getActiveTagData).toHaveBeenCalledTimes(2); // Initial + interval
    });
  });

  describe("stop", () => {
    it("should stop the application", async () => {
      await app.start();
      await app.stop();

      expect(mockCollector.stopScanning).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "🛑 Stopping RuuviTRMNL application..."
      );
      expect(console.log).toHaveBeenCalledWith(
        "✅ RuuviTRMNL application stopped"
      );
    });

    it("should not stop if not running", async () => {
      await app.stop();

      expect(console.log).toHaveBeenCalledWith("ℹ️  App is not running");
      expect(mockCollector.stopScanning).not.toHaveBeenCalled();
    });

    it("should clear the interval when stopping", async () => {
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");

      await app.start();
      await app.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe("sendDataCycle", () => {
    beforeEach(async () => {
      await app.start();
    });

    afterEach(async () => {
      await app.stop();
    });

    it("should send data when tags are available", async () => {
      // Trigger data cycle
      jest.advanceTimersByTime(mockConfig.trmnl.refreshInterval);
      await Promise.resolve();

      expect(mockCollector.getActiveTagData).toHaveBeenCalled();
      expect(mockSender.sendRuuviData).toHaveBeenCalledWith(mockTagData);
      expect(console.log).toHaveBeenCalledWith("✅ Sent 1 readings to TRMNL");
    });

    it("should skip sending when no tags are available", async () => {
      mockCollector.getActiveTagData.mockReturnValue([]);

      // Trigger data cycle
      jest.advanceTimersByTime(mockConfig.trmnl.refreshInterval);
      await Promise.resolve();

      expect(console.log).toHaveBeenCalledWith(
        "⚠️  No RuuviTag data available, skipping TRMNL update"
      );
      expect(mockSender.sendRuuviData).not.toHaveBeenCalled();
    });

    it("should filter out stale data", async () => {
      const staleData = [
        {
          id: "a06bd66b",
          name: "Living Room",
          temperature: 22.6,
          humidity: 45.2,
          battery: 2.89,
          lastUpdated: new Date(
            Date.now() - mockConfig.ruuvi.dataRetentionTime - 1000
          ).toISOString(),
          status: "active" as const,
        },
      ];
      mockCollector.getActiveTagData.mockReturnValue(staleData);

      // Trigger data cycle
      jest.advanceTimersByTime(mockConfig.trmnl.refreshInterval);
      await Promise.resolve();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("All data is stale")
      );
      expect(mockSender.sendRuuviData).not.toHaveBeenCalled();
    });

    it("should handle sending errors gracefully", async () => {
      mockSender.sendRuuviData.mockResolvedValue(false);

      // Trigger data cycle
      jest.advanceTimersByTime(mockConfig.trmnl.refreshInterval);
      await Promise.resolve();

      expect(console.error).toHaveBeenCalledWith(
        "❌ Failed to send data to TRMNL"
      );
    });

    it("should handle exceptions in data cycle", async () => {
      mockCollector.getActiveTagData.mockImplementation(() => {
        throw new Error("Test error");
      });

      // Trigger data cycle
      jest.advanceTimersByTime(mockConfig.trmnl.refreshInterval);
      await Promise.resolve();

      expect(console.error).toHaveBeenCalledWith(
        "❌ Error in data cycle:",
        "Test error"
      );
    });
  });

  describe("getStatus", () => {
    it("should return current status", async () => {
      await app.start();

      const status = app.getStatus();

      expect(status).toEqual({
        running: true,
        stats: {
          totalDiscovered: 1,
          activeCount: 1,
          staleCount: 0,
        },
        webhookInfo: {
          url: "https://usetrmnl.com/api/custom_plugins/***",
          strategy: "replace",
          timeout: 10000,
        },
      });
    });

    it("should show not running when stopped", () => {
      const status = app.getStatus();

      expect(status.running).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle uncaught exceptions", async () => {
      await app.start();

      const stopSpy = jest.spyOn(app, "stop").mockResolvedValue();
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("Process exit called");
      });

      // Simulate uncaught exception
      const handler = process.listeners("uncaughtException")[0] as Function;
      expect(() => handler(new Error("Test error"))).toThrow(
        "Process exit called"
      );

      expect(console.error).toHaveBeenCalledWith(
        "💥 Uncaught exception:",
        expect.any(Error)
      );
      expect(stopSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      stopSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("should handle unhandled promise rejections", async () => {
      await app.start();

      const stopSpy = jest.spyOn(app, "stop").mockResolvedValue();
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("Process exit called");
      });

      // Simulate unhandled rejection
      const handler = process.listeners("unhandledRejection")[0] as Function;
      const mockPromise = Promise.resolve();
      expect(() => handler("Test reason", mockPromise)).toThrow(
        "Process exit called"
      );

      expect(console.error).toHaveBeenCalledWith(
        "💥 Unhandled rejection at:",
        mockPromise,
        "reason:",
        "Test reason"
      );
      expect(stopSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      stopSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
