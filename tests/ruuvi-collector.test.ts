import { configManager } from "../src/lib/config";

// Mock the config manager
jest.mock("../src/lib/config");
const mockConfigManager = configManager as jest.Mocked<typeof configManager>;

// Mock the node-ruuvitag module
jest.mock("node-ruuvitag", () => ({
  on: jest.fn(),
  findTags: jest.fn(),
}));

describe("RuuviCollector", () => {
  const mockConfig = {
    trmnl: {
      webhookUrl: "https://usetrmnl.com/api/custom_plugins/test-id",
      refreshInterval: 300000,
      maxTagsToDisplay: 5,
      mergeStrategy: "replace" as const,
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigManager.getConfig.mockReturnValue(mockConfig);
    mockConfigManager.getTagAlias.mockImplementation((id: string) => {
      const shortId = id.substring(0, 8);
      const aliases = mockConfig.ruuvi.tagAliases as Record<string, string>;
      return aliases[shortId] || `Tag ${shortId}`;
    });
  });

  describe("RuuviCollector Module", () => {
    it("should be importable and testable", async () => {
      // Dynamic import to test the module can be loaded
      const { RuuviCollector } = await import("../src/collectors/ruuvi-collector");
      expect(RuuviCollector).toBeDefined();

      const collector = new RuuviCollector();
      expect(collector).toBeDefined();

      // Test basic methods exist and return expected types
      const stats = collector.getStats();
      expect(stats).toHaveProperty("totalDiscovered");
      expect(stats).toHaveProperty("activeCount");
      expect(stats).toHaveProperty("staleCount");
      expect(typeof stats.totalDiscovered).toBe("number");
      expect(typeof stats.activeCount).toBe("number");
      expect(typeof stats.staleCount).toBe("number");

      const activeData = collector.getActiveTagData();
      expect(Array.isArray(activeData)).toBe(true);
    });

    it("should handle scanning operations without throwing", async () => {
      const { RuuviCollector } = await import("../src/collectors/ruuvi-collector");
      const collector = new RuuviCollector();

      // Test scanning methods don't throw errors
      expect(() => collector.startScanning()).not.toThrow();
      expect(() => collector.stopScanning()).not.toThrow();
    });

    it("should handle snapshot operations", async () => {
      const { RuuviCollector } = await import("../src/collectors/ruuvi-collector");
      const collector = new RuuviCollector();

      // Test snapshot method returns array
      const snapshot = await collector.findTagsSnapshot();
      expect(Array.isArray(snapshot)).toBe(true);
    });

    it("should properly initialize with empty state", async () => {
      const { RuuviCollector } = await import("../src/collectors/ruuvi-collector");
      const collector = new RuuviCollector();

      const initialStats = collector.getStats();
      expect(initialStats.totalDiscovered).toBe(0);
      expect(initialStats.activeCount).toBe(0);
      expect(initialStats.staleCount).toBe(0);

      const initialData = collector.getActiveTagData();
      expect(initialData).toHaveLength(0);
    });
  });
});
