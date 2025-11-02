import { CacheManager } from "../src/cache/cache-manager";
import { RuuviTagData } from "../src/lib/types";

// Mock fs for testing
jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockRejectedValue({ code: "ENOENT" }),
  },
}));

describe("CacheManager", () => {
  let cacheManager: CacheManager;
  const mockTagData: RuuviTagData = {
    id: "a06bd66b",
    name: "Test Tag",
    temperature: 22.5,
    humidity: 45.0,
    pressure: 1013.25,
    battery: 2.89,
    signal: -65,
    lastUpdated: new Date().toISOString(),
    status: "active",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheManager = new CacheManager("test-cache.json");
    await cacheManager.initialize();
  });

  describe("updateTagData", () => {
    it("should detect data changes", () => {
      // First update should be a change (new data)
      const changed1 = cacheManager.updateTagData(mockTagData);
      expect(changed1).toBe(true);

      // Same data should not be a change
      const changed2 = cacheManager.updateTagData(mockTagData);
      expect(changed2).toBe(false);

      // Modified data should be a change
      const modifiedData = { ...mockTagData, temperature: 23.0 };
      const changed3 = cacheManager.updateTagData(modifiedData);
      expect(changed3).toBe(true);
    });

    it("should handle missing values consistently", () => {
      const { pressure, ...dataWithoutPressure } = mockTagData;
      const changed1 = cacheManager.updateTagData(
        dataWithoutPressure as RuuviTagData
      );
      expect(changed1).toBe(true);

      // Same data without pressure should not be a change
      const changed2 = cacheManager.updateTagData(
        dataWithoutPressure as RuuviTagData
      );
      expect(changed2).toBe(false);
    });
  });

  describe("getChangedTags", () => {
    it("should return only allowed tags that have changed", () => {
      // Add some data
      cacheManager.updateTagData(mockTagData);
      cacheManager.updateTagData({
        ...mockTagData,
        id: "c8cfe694",
        name: "Another Tag",
      });

      // Only first tag is allowed
      const allowedTagIds = ["a06bd66b"];
      const changedTags = cacheManager.getChangedTags(allowedTagIds);

      expect(changedTags).toHaveLength(1);
      expect(changedTags[0]?.id).toBe("a06bd66b");
    });

    it("should not return tags already sent", () => {
      // Add data
      cacheManager.updateTagData(mockTagData);

      // Mark as sent
      cacheManager.markTagsAsSent(["a06bd66b"]);

      // Should not return sent tags
      const changedTags = cacheManager.getChangedTags(["a06bd66b"]);
      expect(changedTags).toHaveLength(0);
    });
  });

  describe("getCacheStatsForAllowedTags", () => {
    it("should return accurate statistics", () => {
      // Add allowed and non-allowed tags
      cacheManager.updateTagData(mockTagData); // allowed
      cacheManager.updateTagData({
        ...mockTagData,
        id: "xyz12345",
        name: "Not Allowed",
      }); // not allowed

      const stats = cacheManager.getCacheStatsForAllowedTags(["a06bd66b"]);

      expect(stats.totalTags).toBe(2);
      expect(stats.allowedTags).toBe(1);
      expect(stats.pendingSend).toBe(1);
    });
  });

  describe("markTagsAsSent", () => {
    it("should update last sent time", () => {
      // Add data
      cacheManager.updateTagData(mockTagData);

      // Should be pending initially
      let changedTags = cacheManager.getChangedTags(["a06bd66b"]);
      expect(changedTags).toHaveLength(1);

      // Mark as sent
      cacheManager.markTagsAsSent(["a06bd66b"]);

      // Should no longer be pending
      changedTags = cacheManager.getChangedTags(["a06bd66b"]);
      expect(changedTags).toHaveLength(0);
    });
  });

  describe("ordering", () => {
    it("should preserve order in getAllTags", () => {
      const cacheManager = new CacheManager();

      // Add tags in one order
      cacheManager.updateTagData({
        id: "tag001",
        name: "First",
        temperature: 20.0,
        humidity: 50.0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      });

      cacheManager.updateTagData({
        id: "tag002",
        name: "Second",
        temperature: 22.0,
        humidity: 55.0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      });

      cacheManager.updateTagData({
        id: "tag003",
        name: "Third",
        temperature: 24.0,
        humidity: 60.0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      });

      // Request in specific order
      const orderedTags = cacheManager.getAllTags([
        "tag003",
        "tag001",
        "tag002",
      ]);

      expect(orderedTags).toHaveLength(3);
      expect(orderedTags[0]?.id).toBe("tag003");
      expect(orderedTags[1]?.id).toBe("tag001");
      expect(orderedTags[2]?.id).toBe("tag002");
    });

    it("should preserve order in getChangedTags", () => {
      const cacheManager = new CacheManager();

      // Add tags
      cacheManager.updateTagData({
        id: "tag001",
        name: "First",
        temperature: 20.0,
        humidity: 50.0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      });

      cacheManager.updateTagData({
        id: "tag002",
        name: "Second",
        temperature: 22.0,
        humidity: 55.0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      });

      cacheManager.updateTagData({
        id: "tag003",
        name: "Third",
        temperature: 24.0,
        humidity: 60.0,
        lastUpdated: new Date().toISOString(),
        status: "active",
      });

      // Request changed tags in specific order
      const changedTags = cacheManager.getChangedTags([
        "tag003",
        "tag001",
        "tag002",
      ]);

      expect(changedTags).toHaveLength(3);
      expect(changedTags[0]?.id).toBe("tag003");
      expect(changedTags[1]?.id).toBe("tag001");
      expect(changedTags[2]?.id).toBe("tag002");
    });
  });
});
