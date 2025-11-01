import { Liquid } from "liquidjs";
import * as fs from "fs";
import * as path from "path";

describe("Template Rendering", () => {
  let liquid: Liquid;

  beforeAll(() => {
    liquid = new Liquid();
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
