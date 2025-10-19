import { Liquid } from "liquidjs";
import * as fs from "fs";
import * as path from "path";

describe("Template Rendering", () => {
  let liquid: Liquid;

  beforeAll(() => {
    liquid = new Liquid();
  });

  describe("quadrant.html", () => {
    let templateContent: string;

    beforeAll(() => {
      const templatePath = path.join(
        __dirname,
        "..",
        "templates",
        "quadrant.html"
      );
      templateContent = fs.readFileSync(templatePath, "utf-8");
    });

    it("should render template with active sensor data", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Living Room",
            temperature: 22.5,
            humidity: 45.8,
            battery: 2850,
            status: "active",
            lastSeen: new Date("2024-01-15T10:30:00Z"),
          },
          {
            name: "Bedroom",
            temperature: 20.1,
            humidity: 52.3,
            battery: 2920,
            status: "active",
            lastSeen: new Date("2024-01-15T10:29:45Z"),
          },
          {
            name: "Kitchen",
            temperature: 24.8,
            humidity: 38.2,
            battery: 2780,
            status: "active",
            lastSeen: new Date("2024-01-15T10:30:15Z"),
          },
          {
            name: "Garage",
            temperature: 5.2,
            humidity: 68.5,
            battery: 2650,
            status: "active",
            lastSeen: new Date("2024-01-15T10:29:30Z"),
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Verify that sensor names are rendered (may be truncated)
      expect(renderedHtml).toContain("Livin"); // "Living Room" truncated
      expect(renderedHtml).toContain("Bedroom");
      expect(renderedHtml).toContain("Kitchen");
      expect(renderedHtml).toContain("Garage");

      // Verify that temperature values are rendered (rounded)
      expect(renderedHtml).toContain("22.5°");
      expect(renderedHtml).toContain("20.1°");
      expect(renderedHtml).toContain("24.8°");
      expect(renderedHtml).toContain("5.2°");

      // Verify that humidity values are rendered (rounded)
      expect(renderedHtml).toContain("46%"); // 45.8 rounded to 46
      expect(renderedHtml).toContain("52%"); // 52.3 rounded to 52
      expect(renderedHtml).toContain("38%"); // 38.2 rounded to 38
      expect(renderedHtml).toContain("69%"); // 68.5 rounded to 69

      // Verify HTML structure
      expect(renderedHtml).toContain('<div class="layout');
      expect(renderedHtml).toContain("°");
      expect(renderedHtml).toContain("%");

      // Should not contain stale sensor indicators
      expect(renderedHtml).not.toContain("STALE");
    });

    it("should render template with stale sensor data", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Living Room",
            temperature: 22.5,
            humidity: 45.8,
            battery: 2850,
            status: "active",
            lastSeen: new Date("2024-01-15T10:30:00Z"),
          },
          {
            name: "Bedroom",
            temperature: 19.8,
            humidity: 51.2,
            battery: 2920,
            status: "stale",
            lastSeen: new Date("2024-01-15T09:15:00Z"),
          },
          {
            name: "Kitchen",
            temperature: null,
            humidity: null,
            battery: 2650,
            status: "offline",
            lastSeen: new Date("2024-01-14T22:30:00Z"),
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Verify that active sensor is rendered normally
      expect(renderedHtml).toContain("Livin"); // "Living Room" truncated
      expect(renderedHtml).toContain("22.5");
      expect(renderedHtml).toContain("46%"); // 45.8 rounded to 46

      // Verify that stale sensor is rendered with indicator
      expect(renderedHtml).toContain("Bedroom");
      expect(renderedHtml).toContain("19.8");
      expect(renderedHtml).toContain("51%"); // 51.2 rounded to 51
      expect(renderedHtml).toContain("STALE"); // Stale indicator

      // Verify that offline sensor is handled appropriately
      expect(renderedHtml).toContain("Kitchen");
      expect(renderedHtml).toContain("OFFLINE");
      // Should handle null temperature/humidity gracefully with dashes
      expect(renderedHtml).toContain("-°");
      expect(renderedHtml).toContain("-%");
    });

    it("should render template with mixed sensor states", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Sensor 1",
            temperature: 21.0,
            humidity: 50.0,
            battery: 2800,
            status: "active",
            lastSeen: new Date(),
          },
          {
            name: "Sensor 2",
            temperature: 18.5,
            humidity: 55.5,
            battery: 2700,
            status: "stale",
            lastSeen: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Verify both sensors are present
      expect(renderedHtml).toContain("Sensor 1");
      expect(renderedHtml).toContain("Sensor 2");

      // Verify data is rendered (with rounding)
      expect(renderedHtml).toContain("21°"); // 21.0 rounded to 21
      expect(renderedHtml).toContain("18.5°");
      expect(renderedHtml).toContain("50%"); // 50.0 rounded to 50
      expect(renderedHtml).toContain("56%"); // 55.5 rounded to 56

      // Verify proper HTML structure is maintained
      expect(renderedHtml).toMatch(/<div[^>]*class="layout/g);
      expect(renderedHtml).toContain("°");
      expect(renderedHtml).toContain("%");
    });

    it("should handle empty sensor data gracefully", async () => {
      const mockData = {
        ruuvi_tags: [],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Should render without error even with no sensors
      expect(renderedHtml).toBeDefined();
      expect(typeof renderedHtml).toBe("string");

      // Should still contain basic HTML structure
      expect(renderedHtml).toContain("<div");
    });

    it("should validate rendered HTML structure", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Test Sensor",
            temperature: 23.4,
            humidity: 47.2,
            battery: 2890,
            status: "active",
            lastSeen: new Date(),
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Verify HTML structure basics
      expect(renderedHtml).toMatch(/<div[^>]*>/);
      expect(renderedHtml).toContain("Test"); // "Test Sensor" may be truncated
      expect(renderedHtml).toContain("23.4");
      expect(renderedHtml).toContain("47%"); // 47.2 rounded to 47

      // Verify no template syntax remains unprocessed
      expect(renderedHtml).not.toContain("{{");
      expect(renderedHtml).not.toContain("}}");
      expect(renderedHtml).not.toContain("{%");
      expect(renderedHtml).not.toContain("%}");
    });
  });
});
