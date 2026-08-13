import { describe, expect, it } from "vitest";
import { demoNow, demoToday } from "./clock";
import { meta } from "./data";

describe("prototype time", () => {
  it("puts new work on the demo day, whatever the real date is", () => {
    expect(demoNow(new Date(2027, 0, 9, 14, 32, 7)).slice(0, 10)).toBe(meta.demoDate);
  });

  it("keeps the real time of day, so a docket says when it was opened", () => {
    expect(demoNow(new Date(2027, 0, 9, 14, 32, 7))).toBe(`${meta.demoDate}T14:32:07`);
  });

  it("pads single digits, so the stamp is always the same length", () => {
    expect(demoNow(new Date(2027, 0, 9, 9, 5, 3))).toBe(`${meta.demoDate}T09:05:03`);
  });

  it("agrees with the day the demo trades", () => {
    expect(demoToday()).toBe(meta.demoDate);
    expect(demoNow().startsWith(demoToday())).toBe(true);
  });
});
