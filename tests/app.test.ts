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
      refreshInterval: 5, // Short interval for testing
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

    mockConfigManager.getConfig.mockReturnValue(mockConfig);
    mockConfigManager.getTrmnlWebhookUrl.mockReturnValue(
      mockConfig.trmnl.webhookUrl
    );
    mockConfigManager.getOrderedTagIds.mockReturnValue(["a06bd66b"]);

    // Create mock instances
    mockCollector = {
      initialize: jest.fn().mockResolvedValue(undefined),
      startScanning: jest.fn().mockResolvedValue(undefined),
      stopScanning: jest.fn().mockResolvedValue(undefined),
      getActiveTagData: jest.fn().mockReturnValue(mockTagData),
      getChangedTagsForSending: jest.fn().mockReturnValue(mockTagData),
      getAllConfiguredTags: jest.fn().mockReturnValue(mockTagData),
      hasChangedConfiguredTags: jest.fn().mockReturnValue(true),
      markTagsAsSent: jest.fn().mockReturnValue(undefined),
      getCacheStats: jest.fn().mockReturnValue({
        totalTags: 1,
        allowedTags: 1,
        pendingSend: 1,
      }),
      saveCache: jest.fn().mockResolvedValue(undefined),
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
  });

  describe("constructor", () => {
    it("should create instances of collector and sender", () => {
      expect(MockRuuviCollector).toHaveBeenCalled();
      expect(MockTrmnlWebhookSender).toHaveBeenCalled();
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
    });
  });

  describe("start", () => {
    it("should start the application successfully", async () => {
      await app.start();

      expect(mockCollector.initialize).toHaveBeenCalled();
      expect(mockSender.testConnection).toHaveBeenCalled();
      expect(mockCollector.startScanning).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "🚀 Starting RuuviTRMNL application..."
      );
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
  });

  describe("stop", () => {
    it("should stop the application", async () => {
      await app.start();
      await app.stop();

      expect(mockCollector.stopScanning).toHaveBeenCalled();
      expect(mockCollector.saveCache).toHaveBeenCalled();
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

  describe("basic functionality", () => {
    it("should initialize all components", async () => {
      await app.start();

      expect(mockCollector.initialize).toHaveBeenCalled();
      expect(mockSender.testConnection).toHaveBeenCalled();
      expect(mockCollector.startScanning).toHaveBeenCalled();
    });

    it("should handle graceful shutdown", async () => {
      await app.start();
      await app.stop();

      expect(mockCollector.saveCache).toHaveBeenCalled();
      expect(mockCollector.stopScanning).toHaveBeenCalled();
    });
  });
});
