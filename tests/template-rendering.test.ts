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
            lastUpdated: new Date().toISOString(),
          },
          {
            name: "Bedroom",
            temperature: 20.1,
            humidity: 52.3,
            battery: 2920,
            status: "active",
            lastUpdated: new Date().toISOString(),
          },
          {
            name: "Kitchen",
            temperature: 24.8,
            humidity: 38.2,
            battery: 2780,
            status: "active",
            lastUpdated: new Date().toISOString(),
          },
          {
            name: "Garage",
            temperature: 5.2,
            humidity: 68.5,
            battery: 2650,
            status: "active",
            lastUpdated: new Date().toISOString(),
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
            lastUpdated: new Date().toISOString(),
          },
          {
            name: "Bedroom",
            temperature: 19.8,
            humidity: 51.2,
            battery: 2920,
            status: "stale",
            lastUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago (stale but not offline)
          },
          {
            name: "Kitchen",
            temperature: null,
            humidity: null,
            battery: 2650,
            status: "offline",
            lastUpdated: new Date(
              Date.now() - 24 * 60 * 60 * 1000
            ).toISOString(), // 24 hours ago
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

      // Verify that stale sensor is rendered with timestamp in title (sensor is 45 min old)
      expect(renderedHtml).toContain("Bedroom"); // "Bedroom" shown with timestamp
      expect(renderedHtml).toContain("19.8");
      expect(renderedHtml).toContain("51%"); // 51.2 rounded to 51
      // Should show timestamp in title since sensor is stale (45 minutes old)
      expect(renderedHtml).toMatch(/Bedroom\s+\(\d{2}:\d{2}\)/); // Bedroom with timestamp in brackets

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
            lastUpdated: new Date().toISOString(),
          },
          {
            name: "Sensor 2",
            temperature: 18.5,
            humidity: 55.5,
            battery: 2700,
            status: "stale",
            lastUpdated: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
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
            lastUpdated: new Date().toISOString(),
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

  describe("responsive.html", () => {
    let templateContent: string;

    beforeAll(() => {
      const templatePath = path.join(
        __dirname,
        "..",
        "templates",
        "responsive.html"
      );
      templateContent = fs.readFileSync(templatePath, "utf-8");
    });

    it("should render with responsive classes", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Living Room",
            temperature: 22.5,
            humidity: 45.8,
            battery: 2850,
            status: "active",
            lastUpdated: new Date().toISOString(),
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Verify responsive classes are present
      expect(renderedHtml).toContain("sm:");
      expect(renderedHtml).toContain("md:");
      expect(renderedHtml).toContain("lg:");

      // Verify content is rendered (name may be truncated)
      expect(renderedHtml).toContain("Livin");
      expect(renderedHtml).toContain("22.5");
      expect(renderedHtml).toContain("46%"); // 45.8 rounded to 46
    });

    it("should include data-value-fit attribute", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Test",
            temperature: 23.4,
            humidity: 47.2,
            battery: 2890,
            status: "active",
            lastUpdated: new Date().toISOString(),
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      // Verify fit value attribute is present
      expect(renderedHtml).toContain('data-value-fit="true"');
    });

    it("should handle all sensor states", async () => {
      const mockData = {
        ruuvi_tags: [
          {
            name: "Active",
            temperature: 22.5,
            humidity: 45.8,
            battery: 2850,
            status: "active",
            lastUpdated: new Date().toISOString(),
          },
          {
            name: "Stale",
            temperature: 19.8,
            humidity: 51.2,
            battery: 2920,
            status: "stale",
            lastUpdated: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          },
          {
            name: "Offline",
            temperature: null,
            humidity: null,
            battery: 2650,
            status: "offline",
            lastUpdated: new Date(
              Date.now() - 24 * 60 * 60 * 1000
            ).toISOString(),
          },
        ],
      };

      const renderedHtml = await liquid.parseAndRender(
        templateContent,
        mockData
      );

      expect(renderedHtml).toContain("Active");
      expect(renderedHtml).toContain("Stale");
      expect(renderedHtml).toContain("Offline");
      expect(renderedHtml).toContain("OFFLINE");
      expect(renderedHtml).toContain("-°"); // Null temperature
      expect(renderedHtml).toContain("-%"); // Null humidity
    });
  });
});
