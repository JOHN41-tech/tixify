export type DiscoveryEvent = {
  id: number;
  name: string;
  description: string;
  startTime: Date | string;
  venueName: string;
  venueAddress?: string | null;
  capacity: number;
  availableSeats?: number | null;
  category?: string | null;
  status: string;
  slug: string;
};

export type DiscoveryFilters = {
  search: string;
  category: string;
  dateRange: "any" | "7" | "30";
  availability: "any" | "available";
  sort: "soonest" | "latest" | "availability" | "name";
};

export function filterAndSortEvents(events: DiscoveryEvent[], filters: DiscoveryFilters, now = Date.now()) {
  const maxDate = filters.dateRange === "7" ? now + 7 * 86400000 : filters.dateRange === "30" ? now + 30 * 86400000 : Number.POSITIVE_INFINITY;
  const search = filters.search.toLowerCase().trim();
  return events.filter((event) => {
    const eventDate = new Date(event.startTime).getTime();
    const matchesSearch = `${event.name} ${event.description} ${event.venueName}`.toLowerCase().includes(search);
    const matchesCategory = filters.category === "all" || event.category === filters.category;
    const matchesDate = eventDate >= now && eventDate <= maxDate;
    const matchesAvailability = filters.availability === "any" || Number(event.availableSeats ?? 0) > 0;
    return matchesSearch && matchesCategory && (filters.dateRange === "any" || matchesDate) && matchesAvailability;
  }).sort((a, b) => {
    if (filters.sort === "latest") return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort === "availability") return Number(b.availableSeats ?? 0) - Number(a.availableSeats ?? 0);
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
}
