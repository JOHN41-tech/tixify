import { describe, expect, it } from "vitest";

type SeatState = "AVAILABLE" | "RESERVED";

async function raceReservations(attempts: number) {
  let state: SeatState = "AVAILABLE";
  let winners = 0;
  const lock = { current: Promise.resolve() };
  await Promise.all(Array.from({ length: attempts }, async () => {
    const previous = lock.current;
    let release!: () => void;
    lock.current = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    if (state === "AVAILABLE") { state = "RESERVED"; winners += 1; }
    release();
  }));
  return { state, winners };
}

async function racePurchaseLimit(requests: number[], limit: number) {
  let held = 0;
  const lock = { current: Promise.resolve() };
  let accepted = 0;
  await Promise.all(requests.map(async (quantity) => {
    const previous = lock.current;
    let release!: () => void;
    lock.current = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    if (held + quantity <= limit) { held += quantity; accepted += quantity; }
    release();
  }));
  return { held, accepted };
}

describe("concurrency invariants", () => {
  it.each([100, 500, 1000])("allows exactly one winner for %i same-seat attempts", async (attempts) => {
    await expect(raceReservations(attempts)).resolves.toEqual({ state: "RESERVED", winners: 1 });
  });

  it.each([{ requests: [3, 3] }, { requests: [4, 4] }, { requests: [2, 2, 2] }, { requests: [1, 1, 1, 1, 1] }])("never exceeds a four-ticket user limit", async ({ requests }) => {
    const result = await racePurchaseLimit(requests, 4);
    expect(result.held).toBeLessThanOrEqual(4);
    expect(result.accepted).toBeLessThanOrEqual(4);
  });
});
