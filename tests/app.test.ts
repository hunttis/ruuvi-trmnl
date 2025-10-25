import { RuuviTrmnlApp } from "../src/app";

describe("RuuviTrmnlApp Basic Tests", () => {
  it("should be importable", () => {
    expect(RuuviTrmnlApp).toBeDefined();
    expect(typeof RuuviTrmnlApp).toBe("function");
  });

  describe("Rate Limiting", () => {
    let app: RuuviTrmnlApp;

    beforeEach(() => {
      app = new RuuviTrmnlApp();
    });

    it("should not be rate limited initially", () => {
      expect(app.isRateLimited()).toBe(false);
      expect(app.getRateLimitRemainingTime()).toBe(0);
    });

    it("should be rate limited when rateLimitedUntil is set", () => {
      const futureTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now
      (app as any).rateLimitedUntil = futureTime;

      expect(app.isRateLimited()).toBe(true);
      expect(app.getRateLimitRemainingTime()).toBeGreaterThan(4);
      expect(app.getRateLimitRemainingTime()).toBeLessThan(6);
    });

    it("should not be rate limited when rateLimitedUntil is in the past", () => {
      const pastTime = Date.now() - 1 * 60 * 1000; // 1 minute ago
      (app as any).rateLimitedUntil = pastTime;

      expect(app.isRateLimited()).toBe(false);
      expect(app.getRateLimitRemainingTime()).toBe(0);
    });

    it("should calculate remaining time correctly when rate limited", () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      (app as any).rateLimitedUntil = futureTime;

      expect(app.getRateLimitRemainingTime()).toBeGreaterThan(9);
      expect(app.getRateLimitRemainingTime()).toBeLessThan(11);
    });
  });
});
