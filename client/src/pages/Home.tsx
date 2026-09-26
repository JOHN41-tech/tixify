import { CalendarDays, ChevronRight, Clock3, MapPin, ShieldCheck, Ticket, Zap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const fallbackEvents = [{
  id: 1,
  name: "TechFest 2026",
  description: "A high-energy night of future-facing talks, live demos, and builder culture.",
  startTime: new Date(Date.now() + 21 * 86400000),
  venueName: "Main Arena",
  venueAddress: "1 Tixify Way, Mumbai",
  capacity: 60,
  status: "PUBLISHED",
  slug: "techfest-2026",
}];

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function Home() {
  const { data, isLoading } = trpc.events.list.useQuery();
  const events = data?.length ? data : fallbackEvents;
  return (
    <div className="min-h-screen overflow-hidden bg-[#0e0e0c] text-[#f7f5ef]">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ddff5a] text-[#10110c]"><Ticket className="h-5 w-5" /></div><span className="text-xl font-semibold tracking-[-0.04em]">tixify<span className="text-[#ddff5a]">.</span></span></Link>
        <nav className="hidden items-center gap-8 text-sm text-[#aaa99e] md:flex"><a href="#events" className="transition hover:text-white">Events</a><a href="#promise" className="transition hover:text-white">Why Tixify</a><Link href="/tickets" className="transition hover:text-white">My tickets</Link></nav>
        <Link href="/login"><Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">Sign in <ChevronRight className="ml-1 h-4 w-4" /></Button></Link>
      </header>

      <main>
        <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-16 lg:px-10 lg:pb-32 lg:pt-20">
          <div className="pointer-events-none absolute -right-32 top-0 h-[32rem] w-[32rem] rounded-full bg-[#ddff5a]/10 blur-3xl" />
          <div className="pointer-events-none absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-[#765cff]/10 blur-3xl" />
          <div className="relative grid gap-16 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#ddff5a]/20 bg-[#ddff5a]/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#ddff5a]"><span className="h-1.5 w-1.5 rounded-full bg-[#ddff5a] shadow-[0_0_12px_#ddff5a]" /> Live inventory, zero guesswork</div>
              <h1 className="max-w-4xl text-6xl font-semibold leading-[.92] tracking-[-0.07em] sm:text-7xl lg:text-[8.5rem]">Make the<br /><span className="text-[#ddff5a]">moment.</span></h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[#aaa99e]">Seats move fast. Your booking should not. Tixify keeps every reservation fair, verified, and in sync — even when the room is full.</p>
              <div className="mt-10 flex flex-wrap gap-3"><a href="#events"><Button className="h-12 rounded-full bg-[#ddff5a] px-6 text-[#10110c] hover:bg-[#cfff32]">Explore events <ChevronRight className="ml-2 h-4 w-4" /></Button></a><Link href="/tickets"><Button variant="outline" className="h-12 rounded-full border-white/15 bg-transparent px-6 text-white hover:bg-white/10">View my tickets</Button></Link></div>
            </div>
            <div className="relative hidden min-h-[22rem] lg:block">
              <div className="absolute right-8 top-8 h-64 w-52 rotate-6 rounded-[2rem] border border-white/15 bg-gradient-to-br from-[#282922] to-[#171815] p-5 shadow-2xl shadow-black/40"><div className="flex items-start justify-between"><span className="text-xs font-medium uppercase tracking-[.2em] text-[#ddff5a]">TIX / 001</span><Zap className="h-4 w-4 text-[#ddff5a]" /></div><div className="mt-20 text-2xl font-semibold tracking-tight">Next<br />up.</div><div className="mt-6 flex items-end justify-between text-[10px] text-[#85857b]"><span>LIVE ACCESS</span><span>2026</span></div></div>
              <div className="absolute bottom-0 left-20 h-48 w-60 -rotate-6 rounded-[2rem] border border-[#ddff5a]/20 bg-[#ddff5a] p-6 text-[#10110c] shadow-2xl shadow-[#ddff5a]/10"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[.2em]">Seat map</span><span className="text-xs">A — C</span></div><div className="mt-10 grid grid-cols-6 gap-2">{Array.from({ length: 18 }).map((_, i) => <span key={i} className={`h-3 rounded-full ${i === 7 || i === 12 ? "bg-[#10110c]" : "bg-[#a6c33e]"}`} />)}</div><p className="mt-8 text-xs font-medium">Every seat, accounted for.</p></div>
            </div>
          </div>
        </section>

        <section id="events" className="bg-[#f7f5ef] px-5 py-20 text-[#171814] lg:px-10 lg:py-28"><div className="mx-auto max-w-7xl"><div className="mb-12 flex items-end justify-between gap-6"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-[#68675d]">On the calendar</p><h2 className="text-4xl font-semibold tracking-[-.06em] sm:text-6xl">Find your<br /><span className="text-[#7b3ff2]">next thing.</span></h2></div><span className="hidden text-sm text-[#68675d] sm:block">{isLoading ? "Loading live events…" : `${events.length} event${events.length === 1 ? "" : "s"} available`}</span></div>
          <div className="grid gap-5 lg:grid-cols-2">{events.map((event) => <Link key={event.id} href={`/events/${event.id}`} className="group"><article className="relative overflow-hidden rounded-[2rem] border border-[#dedcd2] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-[#7b3ff2]/40 hover:shadow-2xl hover:shadow-[#7b3ff2]/10 sm:p-8"><div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#ddff5a]/40 blur-3xl transition group-hover:bg-[#ddff5a]/70" /><div className="relative flex items-start justify-between"><span className="rounded-full bg-[#f1f0e9] px-3 py-1 text-xs font-semibold uppercase tracking-[.16em]">Featured</span><span className="grid h-11 w-11 place-items-center rounded-full bg-[#171814] text-white transition group-hover:bg-[#7b3ff2]"><ChevronRight className="h-5 w-5" /></span></div><div className="relative mt-16"><h3 className="max-w-md text-3xl font-semibold tracking-[-.05em] sm:text-4xl">{event.name}</h3><p className="mt-3 max-w-lg text-sm leading-6 text-[#68675d]">{event.description}</p><div className="mt-8 flex flex-wrap gap-4 border-t border-[#eeece5] pt-5 text-sm text-[#68675d]"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#7b3ff2]" /> {formatDate(event.startTime)}</span><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#7b3ff2]" /> {event.venueName}</span></div></div></article></Link>)}</div></div></section>

        <section id="promise" className="mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-28"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr]"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.2em] text-[#ddff5a]">The Tixify promise</p><h2 className="text-4xl font-semibold leading-tight tracking-[-.06em] sm:text-5xl">Calm in the<br /><span className="text-[#aaa99e]">rush.</span></h2></div><div className="grid gap-8 sm:grid-cols-3">{[[ShieldCheck, "Fair by design", "Server-side reservations keep seats from being double-booked."], [Clock3, "Five minute hold", "A clear countdown gives you time to check out without stress."], [Zap, "Instant sync", "Live seat updates keep every screen honest in the room."]].map(([Icon, title, text]) => <div key={title as string} className="border-t border-white/15 pt-5"><Icon className="h-5 w-5 text-[#ddff5a]" /><h3 className="mt-7 text-lg font-medium">{title as string}</h3><p className="mt-3 text-sm leading-6 text-[#aaa99e]">{text as string}</p></div>)}</div></div></section>
      </main>
      <footer className="border-t border-white/10 px-5 py-8 text-sm text-[#77776d] lg:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between"><span>© 2026 Tixify</span><span>Built for the moment.</span></div></footer>
    </div>
  );
}
