import { describe, expect, it } from "vitest";
import { countdownProgress, formatCountdown, secondsUntil } from "./countdown";

describe("checkout countdown", () => {
  it("calculates remaining seconds from an absolute expiry", () => {
    expect(secondsUntil("2026-09-26T00:05:00.000Z", Date.parse("2026-09-26T00:03:41.500Z"))).toBe(79);
    expect(secondsUntil("2026-09-26T00:03:00.000Z", Date.parse("2026-09-26T00:03:41.500Z"))).toBe(0);
  });

  it("formats the timer as minutes and seconds", () => {
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(79)).toBe("1:19");
  });

  it("clamps progress to a usable 0–100 range", () => {
    expect(countdownProgress(300)).toBe(100);
    expect(countdownProgress(150)).toBe(50);
    expect(countdownProgress(-1)).toBe(0);
    expect(countdownProgress(400)).toBe(100);
  });
});
