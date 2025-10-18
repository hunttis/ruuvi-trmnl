import { configManager } from "../src/config";
import * as fs from "fs";
import * as path from "path";

// Mock fs module
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

describe("ConfigManager", () => {
  const mockConfig = {
    trmnl: {
      webhookUrl: "https://usetrmnl.com/api/custom_plugins/test-webhook-id",
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
        c8cfe694: "Bedroom",
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton state
    (configManager as any).config = null;
  });

  describe("loadConfig", () => {
    it("should load config from file successfully", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = configManager.loadConfig();

      expect(config).toEqual(mockConfig);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "config.json")
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "config.json"),
        "utf8"
      );
    });

    it("should throw error when config file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => configManager.loadConfig()).toThrow(
        "Process.exit(1) called"
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Failed to load configuration:"
      );
    });

    it("should throw error when config file has invalid JSON", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      expect(() => configManager.loadConfig()).toThrow(
        "Process.exit(1) called"
      );
      expect(console.error).toHaveBeenCalledWith(
        "❌ Failed to load configuration:"
      );
    });

    it("should return cached config on subsequent calls", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config1 = configManager.loadConfig();
      const config2 = configManager.loadConfig();

      expect(config1).toBe(config2);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("getConfig", () => {
    it("should return config when already loaded", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      configManager.loadConfig();
      const config = configManager.getConfig();

      expect(config).toEqual(mockConfig);
    });

    it("should load config if not already loaded", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const config = configManager.getConfig();

      expect(config).toEqual(mockConfig);
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTrmnlWebhookUrl", () => {
    it("should return webhook URL when properly configured", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const url = configManager.getTrmnlWebhookUrl();

      expect(url).toBe(mockConfig.trmnl.webhookUrl);
    });

    it("should throw error when webhook URL is not configured", () => {
      const configWithoutUrl = {
        ...mockConfig,
        trmnl: { ...mockConfig.trmnl, webhookUrl: "" },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configWithoutUrl));

      expect(() => configManager.getTrmnlWebhookUrl()).toThrow(
        "TRMNL webhook URL not configured. Please update config.json"
      );
    });

    it("should throw error when webhook URL is placeholder", () => {
      const configWithPlaceholder = {
        ...mockConfig,
        trmnl: {
          ...mockConfig.trmnl,
          webhookUrl: "YOUR_TRMNL_WEBHOOK_URL_HERE",
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify(configWithPlaceholder)
      );

      expect(() => configManager.getTrmnlWebhookUrl()).toThrow(
        "TRMNL webhook URL not configured. Please update config.json"
      );
    });
  });

  describe("getTagAlias", () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    });

    it("should return alias for full MAC address", () => {
      const alias = configManager.getTagAlias("a06bd66b3c6d4e8f");
      expect(alias).toBe("Living Room");
    });

    it("should return alias for shortened ID", () => {
      const alias = configManager.getTagAlias("a06bd66b12345678");
      expect(alias).toBe("Living Room");
    });

    it("should return default name for unknown tag", () => {
      const alias = configManager.getTagAlias("unknown123");
      expect(alias).toBe("Tag unknown1");
    });

    it("should handle MAC address with colons", () => {
      // The implementation removes colons and lowercases, but uses shortId for fallback
      const alias = configManager.getTagAlias("a0:6b:d6:6b:3c:6d:4e:8f");
      expect(alias).toBe("Tag a0:6b:d6"); // Falls back to shortId since full MAC not in config
    });

    it("should handle uppercase MAC addresses", () => {
      // The implementation lowercases and tries full match first
      const alias = configManager.getTagAlias("A06BD66B3C6D4E8F");
      expect(alias).toBe("Tag A06BD66B"); // Falls back to shortId since full MAC not in config
    });
  });

  describe("getOrderedTagIds", () => {
    it("should return tags in displayOrder when configured", () => {
      // Create a mock config with displayOrder
      const mockConfigWithOrder = {
        ...mockConfig,
        ruuvi: {
          ...mockConfig.ruuvi,
          tagAliases: {
            tag001: "First",
            tag002: "Second",
            tag003: "Third",
          },
          displayOrder: ["tag003", "tag001", "tag002"],
        },
      };

      jest
        .spyOn(configManager, "getConfig")
        .mockReturnValue(mockConfigWithOrder);

      const orderedIds = configManager.getOrderedTagIds();
      expect(orderedIds).toEqual(["tag003", "tag001", "tag002"]);
    });

    it("should return tags in natural order when no displayOrder", () => {
      // Use config without displayOrder
      const mockConfigNoOrder = {
        ...mockConfig,
        ruuvi: {
          ...mockConfig.ruuvi,
          tagAliases: {
            tag001: "First",
            tag002: "Second",
          },
          // No displayOrder property
        },
      };

      jest.spyOn(configManager, "getConfig").mockReturnValue(mockConfigNoOrder);

      const orderedIds = configManager.getOrderedTagIds();
      expect(orderedIds).toEqual(["tag001", "tag002"]);
    });

    it("should append unordered tags to end", () => {
      // Config where displayOrder doesn't include all tags
      const mockConfigPartialOrder = {
        ...mockConfig,
        ruuvi: {
          ...mockConfig.ruuvi,
          tagAliases: {
            tag001: "First",
            tag002: "Second",
            tag003: "Third",
            tag004: "Fourth",
          },
          displayOrder: ["tag003", "tag001"], // Missing tag002 and tag004
        },
      };

      jest
        .spyOn(configManager, "getConfig")
        .mockReturnValue(mockConfigPartialOrder);

      const orderedIds = configManager.getOrderedTagIds();
      expect(orderedIds).toEqual(["tag003", "tag001", "tag002", "tag004"]);
    });
  });
});
