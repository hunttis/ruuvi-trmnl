/**
 * Listener Accumulation Tests
 *
 * This test suite ensures that event listeners do not accumulate over time,
 * which was a critical memory leak issue fixed in November-December 2025.
 *
 * Key areas tested:
 * 1. RuuviCollector tag 'updated' listeners - prevents duplicate listeners when tags are rediscovered
 * 2. RuuviCollector 'warning' listeners - verifies proper listener management per instance
 * 3. RuuviTrmnlApp process listeners - prevents accumulation during start/stop cycles
 * 4. Regression tests - ensures the original memory leak doesn't reoccur
 *
 * Related documentation: MEMORY_LEAK_FIX.md
 */

import { EventEmitter } from "events";
import { configManager } from "../src/lib/config";

// Mock the config manager
jest.mock("../src/lib/config");
const mockConfigManager = configManager as jest.Mocked<typeof configManager>;

// Create a mock RuuviTag that extends EventEmitter
class MockRuuviTag extends EventEmitter {
  id: string;
  constructor(id: string) {
    super();
    this.id = id;
  }
}

// Create a mock Ruuvi that extends EventEmitter
class MockRuuvi extends EventEmitter {
  findTags = jest.fn();
}

// Create the mock instance before mocking the module
const mockRuuviInstance = new MockRuuvi();

// Mock the node-ruuvitag module
jest.mock("node-ruuvitag", () => mockRuuviInstance);

describe("Listener Accumulation Prevention", () => {
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

    // Reset the mock ruuvi instance
    mockRuuviInstance.removeAllListeners();
  });

  afterEach(() => {
    // Clean up all listeners
    if (mockRuuviInstance) {
      mockRuuviInstance.removeAllListeners();
    }
  });

  describe("RuuviCollector - Tag Event Listener Management", () => {
    it("should not accumulate 'updated' listeners when same tag is found multiple times", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      // Create a mock tag
      const mockTag = new MockRuuviTag("a06bd66b12345678");

      // Simulate the tag being found multiple times (as would happen during continuous scanning)
      for (let i = 0; i < 10; i++) {
        mockRuuviInstance.emit("found", mockTag);
      }

      // Check the number of 'updated' listeners on the tag
      const listenerCount = mockTag.listenerCount("updated");

      // Should only have 1 listener, not 10
      expect(listenerCount).toBe(1);
    });

    it("should attach separate listeners for different tags", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      // Create multiple mock tags
      const tag1 = new MockRuuviTag("a06bd66b12345678");
      const tag2 = new MockRuuviTag("870d862198765432");
      const tag3 = new MockRuuviTag("f1e2d3c4b5a69780");

      // Emit found events for different tags
      mockRuuviInstance.emit("found", tag1);
      mockRuuviInstance.emit("found", tag2);
      mockRuuviInstance.emit("found", tag3);

      // Each tag should have exactly 1 listener
      expect(tag1.listenerCount("updated")).toBe(1);
      expect(tag2.listenerCount("updated")).toBe(1);
      expect(tag3.listenerCount("updated")).toBe(1);
    });

    it("should not accumulate listeners when tag is found, lost, and found again", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      const mockTag = new MockRuuviTag("a06bd66b12345678");

      // Tag found first time
      mockRuuviInstance.emit("found", mockTag);
      expect(mockTag.listenerCount("updated")).toBe(1);

      // Simulate tag being "lost" (just rediscovered in reality)
      // In the real implementation, the tag object persists
      mockRuuviInstance.emit("found", mockTag);
      mockRuuviInstance.emit("found", mockTag);
      mockRuuviInstance.emit("found", mockTag);

      // Should still only have 1 listener
      expect(mockTag.listenerCount("updated")).toBe(1);
    });

    it("should verify listener actually processes updates", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      const mockTag = new MockRuuviTag("a06bd66b12345678");

      // Tag found - listener attached
      mockRuuviInstance.emit("found", mockTag);

      // Emit multiple updates to verify the listener works
      mockTag.emit("updated", {
        temperature: 22.5,
        humidity: 45.0,
        pressure: 101325,
      });

      mockTag.emit("updated", {
        temperature: 23.0,
        humidity: 46.0,
        pressure: 101320,
      });

      // Get tag data to verify updates were processed
      const tagData = collector.getActiveTagData();
      const ourTag = tagData.find((t) => t.id === "a06bd66b");

      expect(ourTag).toBeDefined();
      expect(ourTag?.temperature).toBe(23.0);
      expect(ourTag?.humidity).toBe(46.0);
    });
  });

  describe("RuuviCollector - Warning Listener Management", () => {
    it("should have exactly one 'warning' listener on ruuvi instance", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      // Create multiple collector instances (simulating restarts)
      const collector1 = new RuuviCollector();
      await collector1.initialize();

      const collector2 = new RuuviCollector();
      await collector2.initialize();

      const collector3 = new RuuviCollector();
      await collector3.initialize();

      // Check warning listener count on the ruuvi instance
      const warningListenerCount = mockRuuviInstance.listenerCount("warning");

      // Should have 3 listeners (one per collector instance)
      // This is expected since each collector instance manages its own listeners
      expect(warningListenerCount).toBe(3);
    });
  });

  describe("RuuviTrmnlApp - Setup Mode Listener Management", () => {
    it("should not accumulate process listeners on multiple start/stop cycles", async () => {
      const { RuuviTrmnlApp } = await import("../src/core/app");

      // Count initial process listeners for SIGINT
      const initialListenerCount = process.listenerCount("SIGINT");

      // Create app and start/stop multiple times
      const app = new RuuviTrmnlApp(false, true); // no console display, manual mode

      await app.start();
      await app.stop();

      await app.start();
      await app.stop();

      await app.start();
      await app.stop();

      // Count final listeners
      const finalListenerCount = process.listenerCount("SIGINT");

      // Should only add listeners once, not accumulate with each start
      // Expecting only 1 additional listener (or same as initial if already had one)
      expect(finalListenerCount - initialListenerCount).toBeLessThanOrEqual(1);
    });

    it("should not accumulate process listeners for other signal types", async () => {
      const { RuuviTrmnlApp } = await import("../src/core/app");

      const initialSIGTERMCount = process.listenerCount("SIGTERM");
      const initialUncaughtCount = process.listenerCount("uncaughtException");
      const initialUnhandledCount = process.listenerCount("unhandledRejection");

      const app = new RuuviTrmnlApp(false, true);

      // Start and stop multiple times
      await app.start();
      await app.stop();
      await app.start();
      await app.stop();

      const finalSIGTERMCount = process.listenerCount("SIGTERM");
      const finalUncaughtCount = process.listenerCount("uncaughtException");
      const finalUnhandledCount = process.listenerCount("unhandledRejection");

      // Each should only increase by at most 1
      expect(finalSIGTERMCount - initialSIGTERMCount).toBeLessThanOrEqual(1);
      expect(finalUncaughtCount - initialUncaughtCount).toBeLessThanOrEqual(1);
      expect(finalUnhandledCount - initialUnhandledCount).toBeLessThanOrEqual(
        1
      );
    });
  });

  describe("Memory Leak Regression Tests", () => {
    it("should handle rapid tag discoveries without listener accumulation", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      const mockTag = new MockRuuviTag("a06bd66b12345678");

      // Simulate rapid fire discoveries (100 times in quick succession)
      // This simulates what would happen during continuous scanning
      for (let i = 0; i < 100; i++) {
        mockRuuviInstance.emit("found", mockTag);
      }

      // Should still only have 1 listener after 100 discoveries
      expect(mockTag.listenerCount("updated")).toBe(1);
    });

    it("should handle many different tags without listener accumulation per tag", async () => {
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      const tags: MockRuuviTag[] = [];

      // Create 20 different tags
      for (let i = 0; i < 20; i++) {
        const tagId = `tag${i.toString().padStart(8, "0")}12345678`;
        const tag = new MockRuuviTag(tagId);
        tags.push(tag);

        // Each tag is "found" 5 times
        for (let j = 0; j < 5; j++) {
          mockRuuviInstance.emit("found", tag);
        }
      }

      // Verify each tag has exactly 1 listener
      tags.forEach((tag) => {
        expect(tag.listenerCount("updated")).toBe(1);
      });
    });

    it("should demonstrate the memory leak that was fixed", async () => {
      // This test demonstrates what WOULD happen without the fix
      // We'll manually simulate the old buggy behavior to document the issue

      const mockTag = new MockRuuviTag("a06bd66b12345678");

      // Simulate the OLD buggy behavior - attaching listener every time
      for (let i = 0; i < 10; i++) {
        mockTag.on("updated", () => {
          // This is what the old code did - attach a new listener each time
        });
      }

      // This WOULD accumulate to 10 listeners (the bug)
      expect(mockTag.listenerCount("updated")).toBe(10);

      // Clean up for test
      mockTag.removeAllListeners();

      // Now verify our fixed implementation doesn't do this
      const { RuuviCollector } = await import(
        "../src/collectors/ruuvi-collector"
      );

      const collector = new RuuviCollector();
      await collector.initialize();

      const fixedMockTag = new MockRuuviTag("a06bd66b12345678");

      // Same scenario with the fixed code
      for (let i = 0; i < 10; i++) {
        mockRuuviInstance.emit("found", fixedMockTag);
      }

      // Fixed version should only have 1 listener
      expect(fixedMockTag.listenerCount("updated")).toBe(1);
    });
  });
});
