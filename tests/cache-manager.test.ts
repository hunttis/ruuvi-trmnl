import { CacheManager } from "../src/cache-manager";
import { RuuviTagData } from "../src/types";

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
});
