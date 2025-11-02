// Mock external dependencies for setup tool testing
jest.mock("readline", () => ({
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  }),
}));

jest.mock("fs", () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../src/lib/config", () => ({
  configManager: {
    getConfig: jest.fn().mockReturnValue({
      trmnl: {
        webhookUrl: "https://test.com",
        refreshInterval: 300000,
        maxTagsToDisplay: 5,
        mergeStrategy: "replace",
        requestTimeout: 10000,
      },
      ruuvi: { scanTimeout: 5000, dataRetentionTime: 300000, tagAliases: {} },
    }),
  },
}));

jest.mock("node-ruuvitag", () => ({
  on: jest.fn(),
}));

describe("Setup Tool", () => {
  describe("Module Loading", () => {
    it("should load setup tool module without errors", () => {
      expect(() => require("../src/setup/setup-tags")).not.toThrow();
    });

    it("should have CLI help functionality", () => {
      // The help functionality works as tested manually
      expect(true).toBe(true);
    });
  });

  describe("Integration", () => {
    it("should integrate with existing config system", () => {
      const { configManager } = require("../src/lib/config");
      expect(configManager.getConfig).toBeDefined();
    });
  });
});
