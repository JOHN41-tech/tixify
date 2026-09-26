import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, Check, Clock3, LockKeyhole, MapPin, Minus, Plus, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

const sampleSeats = Array.from({ length: 60 }, (_, i) => ({ inventoryId: i + 1, seatId: i + 1, section: String.fromCharCode(65 + Math.floor(i / 20)), row: String.fromCharCode(65 + Math.floor(i / 20)), number: 101 + (i % 20), seatType: Math.floor(i / 20) === 0 ? "VIP" : Math.floor(i / 20) === 1 ? "PREMIUM" : "STANDARD", status: i === 8 || i === 29 ? "RESERVED" : i === 45 ? "SOLD" : "AVAILABLE" }));

const priceFor = (seatType: string) => seatType === "VIP" ? 149 : seatType === "PREMIUM" ? 89 : 49;

export default function EventPage() {
  const [, params] = useRoute("/events/:eventId");
  const [, setLocation] = useLocation();
  const eventId = Number(params?.eventId ?? 1);
  const { user } = useAuth();
  const eventQuery = trpc.events.get.useQuery({ eventId }, { retry: false });
  const seatsQuery = trpc.events.seats.useQuery({ eventId }, { retry: false });
  const [selected, setSelected] = useState<number[]>([]);
  const [holdSeconds, setHoldSeconds] = useState(300);
  const [notice, setNotice] = useState("");
  const event = eventQuery.data ?? { id: eventId, name: "TechFest 2026", description: "A high-energy night of future-facing talks, live demos, and builder culture.", startTime: new Date(Date.now() + 21 * 86400000), venueName: "Main Arena", venueAddress: "1 Tixify Way, Mumbai", maxTicketsPerUser: 4, ticketTypes: [] };
  const seats = seatsQuery.data?.length ? seatsQuery.data : sampleSeats;
  const reserve = trpc.reservations.create.useMutation();

  useEffect(() => { const stream = new EventSource(`/api/events/${eventId}/stream`); stream.addEventListener("inventory", () => { void seatsQuery.refetch(); }); return () => stream.close(); }, [eventId]);
  useEffect(() => { if (!selected.length) return; const timer = window.setInterval(() => setHoldSeconds((seconds) => Math.max(0, seconds - 1)), 1000); return () => window.clearInterval(timer); }, [selected.length]);
  useEffect(() => { if (holdSeconds === 0) { setSelected([]); setNotice("Your selection timed out. Choose another seat."); } }, [holdSeconds]);

  const grouped = useMemo(() => Object.entries(seats.reduce<Record<string, typeof seats>>((acc, seat) => { (acc[seat.section] ??= []).push(seat); return acc; }, {})), [seats]);
  const total = selected.reduce((sum, id) => sum + priceFor(seats.find((seat) => seat.inventoryId === id)?.seatType ?? "STANDARD"), 0);
  const formatDate = new Date(event.startTime).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const toggleSeat = (inventoryId: number, status: string) => {
    if (status !== "AVAILABLE") return;
    setNotice("");
    setSelected((current) => current.includes(inventoryId) ? current.filter((id) => id !== inventoryId) : current.length < (event.maxTicketsPerUser ?? 4) ? [...current, inventoryId] : current);
    setHoldSeconds(300);
  };

  const handleReserve = async () => {
    if (!user) { startLogin(); return; }
    try {
      const result = await reserve.mutateAsync({ eventId, seatIds: selected, idempotencyKey: `reserve-${eventId}-${selected.slice().sort().join("-")}` });
      setLocation(`/checkout?reservation=${result.data.id}`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Those seats are no longer available. Refresh and choose again."); seatsQuery.refetch(); }
  };

  return <div className="min-h-screen bg-[#f7f5ef] text-[#171814]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10"><Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#171814] text-[#ddff5a]"><Ticket className="h-5 w-5" /></div><span className="text-xl font-semibold tracking-[-.04em]">tixify<span className="text-[#7b3ff2]">.</span></span></Link><Link href="/events" className="inline-flex items-center gap-2 text-sm text-[#68675d] hover:text-[#171814]"><ArrowLeft className="h-4 w-4" /> All events</Link></header>
    <main className="mx-auto max-w-7xl px-5 pb-20 lg:px-10"><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start"><section className="rounded-[2rem] bg-[#171814] p-7 text-white sm:p-10"><Badge className="border-0 bg-[#ddff5a] text-[#171814]">LIVE EVENT</Badge><h1 className="mt-8 max-w-lg text-5xl font-semibold leading-[.95] tracking-[-.07em] sm:text-7xl">{event.name}</h1><p className="mt-7 max-w-md text-base leading-7 text-[#aaa99e]">{event.description}</p><div className="mt-10 space-y-4 border-t border-white/10 pt-6 text-sm"><div className="flex items-center gap-3"><Clock3 className="h-4 w-4 text-[#ddff5a]" /><span>{formatDate} · {new Date(event.startTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div><div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-[#ddff5a]" /><span>{event.venueName} · {event.venueAddress}</span></div><div className="flex items-center gap-3"><Users className="h-4 w-4 text-[#ddff5a]" /><span>Max {event.maxTicketsPerUser} tickets per person</span></div></div></section>
      <section className="rounded-[2rem] border border-[#dedcd2] bg-white p-5 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#68675d]">Choose your seats</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.06em]">Live seat map</h2></div><div className="flex items-center gap-3 text-xs text-[#68675d]"><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-[#bcbab0]" /> Available</span><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#ddff5a]" /> Selected</span><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#d8d6ce]" /> Taken</span></div></div><div className="mx-auto mt-9 max-w-2xl rounded-[1.5rem] bg-[#f7f5ef] p-5 sm:p-8"><div className="mb-10 rounded-lg border border-[#c7c5b9] bg-white py-3 text-center text-xs font-semibold uppercase tracking-[.32em] text-[#68675d]">Stage</div><div className="space-y-7">{grouped.map(([section, sectionSeats]) => <div key={section}><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[.16em] text-[#68675d]">Section {section}</span><span className="text-xs text-[#aaa99e]">{sectionSeats[0]?.seatType}</span></div><div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{sectionSeats.map((seat) => { const isSelected = selected.includes(seat.inventoryId); const unavailable = seat.status !== "AVAILABLE"; return <button aria-label={`Seat ${seat.row}${seat.number}`} key={seat.inventoryId} disabled={unavailable} onClick={() => toggleSeat(seat.inventoryId, seat.status)} className={`group relative aspect-square rounded-lg border text-xs font-medium transition ${isSelected ? "border-[#171814] bg-[#ddff5a] text-[#171814] shadow-[0_0_0_3px_#ddff5a]" : unavailable ? "cursor-not-allowed border-transparent bg-[#d8d6ce] text-[#aaa99e]" : "border-[#d3d1c7] bg-white text-[#68675d] hover:-translate-y-0.5 hover:border-[#7b3ff2] hover:text-[#7b3ff2]"}`}>{isSelected ? <Check className="mx-auto h-4 w-4" /> : seat.number % 100}<span className="absolute -bottom-5 left-0 right-0 text-[9px] text-[#aaa99e]">{seat.number}</span></button>; })}</div></div>)}</div></div>{notice && <p className="mt-8 rounded-xl bg-[#fff2dc] px-4 py-3 text-sm text-[#935b16]">{notice}</p>}<div className="mt-10 flex flex-col gap-4 border-t border-[#eeece5] pt-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-[#68675d]">{selected.length ? `${selected.length} seat${selected.length > 1 ? "s" : ""} selected` : "Select up to 4 seats"}</p>{selected.length > 0 && <p className="mt-1 text-2xl font-semibold tracking-[-.04em]">${total.toFixed(2)} <span className="text-sm font-normal text-[#aaa99e]">· holds for {Math.floor(holdSeconds / 60)}:{String(holdSeconds % 60).padStart(2, "0")}</span></p>}</div><Button disabled={!selected.length || reserve.isPending} onClick={handleReserve} className="h-12 rounded-full bg-[#171814] px-7 text-white hover:bg-[#7b3ff2]">{reserve.isPending ? "Holding seats…" : <><LockKeyhole className="mr-2 h-4 w-4" /> Hold & continue</>}</Button></div></section></div></main></div>;
}
