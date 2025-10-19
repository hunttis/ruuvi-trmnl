import { RuuviTrmnlApp } from "../src/app";

describe("RuuviTrmnlApp Basic Tests", () => {
  it("should be importable", () => {
    expect(RuuviTrmnlApp).toBeDefined();
    expect(typeof RuuviTrmnlApp).toBe("function");
  });
});
