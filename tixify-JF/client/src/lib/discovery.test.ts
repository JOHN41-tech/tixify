import { describe, expect, it } from "vitest";
import { filterAndSortEvents, type DiscoveryEvent } from "./discovery";

const now = Date.parse("2026-09-26T00:00:00.000Z");
const events: DiscoveryEvent[] = [
  { id: 1, name: "TechFest", description: "Builders", startTime: "2026-09-29T00:00:00.000Z", venueName: "Arena", capacity: 100, availableSeats: 4, category: "Technology", status: "PUBLISHED", slug: "tech" },
  { id: 2, name: "Late Night Jazz", description: "Live music", startTime: "2026-10-20T00:00:00.000Z", venueName: "Club", capacity: 80, availableSeats: 40, category: "Music", status: "PUBLISHED", slug: "jazz" },
  { id: 3, name: "Sold Out Summit", description: "Talks", startTime: "2026-09-28T00:00:00.000Z", venueName: "Hall", capacity: 50, availableSeats: 0, category: "Technology", status: "PUBLISHED", slug: "sold-out" },
];

describe("event discovery filters", () => {
  it("filters by category and available seats", () => {
    const result = filterAndSortEvents(events, { search: "", category: "Technology", dateRange: "any", availability: "available", sort: "soonest" }, now);
    expect(result.map((event) => event.id)).toEqual([1]);
  });

  it("filters the next seven days and sorts by availability", () => {
    const result = filterAndSortEvents(events, { search: "", category: "all", dateRange: "7", availability: "any", sort: "availability" }, now);
    expect(result.map((event) => event.id)).toEqual([1, 3]);
  });

  it("searches event names, descriptions, and venues", () => {
    const result = filterAndSortEvents(events, { search: "club", category: "all", dateRange: "any", availability: "any", sort: "soonest" }, now);
    expect(result.map((event) => event.id)).toEqual([2]);
  });
});
