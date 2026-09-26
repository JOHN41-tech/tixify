import { type ReactNode, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, Check, ChevronRight, CircleAlert, LogIn, MapPin, Rocket, Save, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

const initialForm = { name: "", category: "Technology", description: "", venueName: "", venueAddress: "", startTime: "", endTime: "", ticketPrice: "49", ticketSlots: "100", maxTicketsPerUser: "4" };

type FormState = typeof initialForm;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="block"><span className="block text-sm font-medium text-[#171814]">{label}</span>{hint && <span className="mt-1 block text-xs text-[#8b897e]">{hint}</span>}<div className="mt-2">{children}</div></label>;
}

export default function OrganizerPage() {
  const { user, loading, logout } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const eventsQuery = trpc.organizer.events.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const createEvent = trpc.organizer.createEvent.useMutation();
  const publishEvent = trpc.organizer.publishEvent.useMutation();
  const utils = trpc.useUtils();
  const previewDate = useMemo(() => form.startTime ? new Date(form.startTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Your event date", [form.startTime]);
  const scheduleError = form.startTime && form.endTime && new Date(form.endTime).getTime() <= new Date(form.startTime).getTime() ? "End time must be after start time." : "";
  const canSubmit = Boolean(form.name.trim() && form.description.trim().length >= 10 && form.venueName.trim() && form.venueAddress.trim() && form.startTime && form.endTime && !scheduleError && Number(form.ticketPrice) >= 0 && Number(form.ticketSlots) > 0 && Number(form.maxTicketsPerUser) > 0);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (publish: boolean) => {
    setFeedback(null);
    const start = new Date(form.startTime);
    const end = new Date(form.endTime);
    if (!form.startTime || !form.endTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFeedback({ type: "error", text: "Choose both a valid start and end time." });
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setFeedback({ type: "error", text: "End time must be after start time. Choose a later end time." });
      return;
    }
    try {
      const result = await createEvent.mutateAsync({
        name: form.name,
        category: form.category,
        description: form.description,
        venueName: form.venueName,
        venueAddress: form.venueAddress,
        startTime: new Date(form.startTime),
        endTime: new Date(form.endTime),
        ticketPrice: Number(form.ticketPrice),
        ticketSlots: Number(form.ticketSlots),
        maxTicketsPerUser: Number(form.maxTicketsPerUser),
        publish,
      });
      await utils.organizer.events.invalidate();
      setFeedback({ type: "success", text: publish ? "Your event is live on Tixify." : "Draft saved. Publish it when the details are ready." });
      setForm(initialForm);
      if (result.status === "PUBLISHED") window.setTimeout(() => window.location.assign(`/events/${result.eventId}`), 700);
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "We could not create this event. Check the details and try again." });
    }
  };
  const publish = async (eventId: number) => {
    try { await publishEvent.mutateAsync({ eventId }); await utils.organizer.events.invalidate(); setFeedback({ type: "success", text: "Event published successfully." }); }
    catch (error) { setFeedback({ type: "error", text: error instanceof Error ? error.message : "Could not publish this event." }); }
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f7f5ef]">Loading organizer workspace…</div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#f7f5ef] px-5 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#171814] text-[#ddff5a]"><Ticket /></div><h1 className="mt-6 text-3xl font-semibold tracking-[-.06em]">Bring your event to life.</h1><p className="mt-3 max-w-sm text-[#68675d]">Sign in to create, publish, and manage events on Tixify.</p><Button onClick={() => startLogin()} className="mt-7 rounded-full bg-[#171814] text-white"><LogIn className="mr-2 h-4 w-4" /> Sign in to organize</Button></div></div>;

  return <div className="min-h-screen bg-[#f7f5ef] text-[#171814]"><header className="border-b border-[#dedcd2] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10"><Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#171814] text-[#ddff5a]"><Ticket className="h-5 w-5" /></div><span className="text-xl font-semibold tracking-[-.04em]">tixify<span className="text-[#7b3ff2]">.</span></span></Link><div className="flex items-center gap-4"><span className="hidden text-sm text-[#68675d] sm:block">Organizer workspace · {user.name ?? "Account"}</span><Button onClick={logout} variant="ghost" className="text-[#68675d]">Sign out</Button></div></div></header><main className="mx-auto max-w-7xl px-5 pb-20 pt-10 lg:px-10"><Link href="/" className="inline-flex items-center gap-2 text-sm text-[#68675d] hover:text-[#171814]"><ArrowLeft className="h-4 w-4" /> Back to Tixify</Link><div className="mt-8 grid gap-8 xl:grid-cols-[1fr_380px]"><section><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#7b3ff2]">Organizer studio</p><h1 className="mt-3 text-5xl font-semibold leading-[.95] tracking-[-.07em] sm:text-6xl">Create the<br /><span className="text-[#7b3ff2]">moment.</span></h1><p className="mt-5 max-w-xl text-[#68675d]">Add the details once. Tixify creates the venue, ticket inventory, pricing, and public event page together.</p></div>{feedback && <div className={`mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${feedback.type === "success" ? "bg-[#ecf7c7] text-[#526b16]" : "bg-[#fff2dc] text-[#935b16]"}`}>{feedback.type === "success" ? <Check className="mt-0.5 h-4 w-4" /> : <CircleAlert className="mt-0.5 h-4 w-4" />}{feedback.text}</div>}<div className="space-y-6"><section className="rounded-[2rem] border border-[#dedcd2] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0effa] text-[#7b3ff2]"><CalendarDays className="h-5 w-5" /></div><div><h2 className="font-semibold">Event details</h2><p className="text-sm text-[#68675d]">Tell people why they should show up.</p></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Event name"><Input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. TechFest 2026" /></Field><Field label="Category"><select value={form.category} onChange={(event) => update("category", event.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"><option>Technology</option><option>Music</option><option>Sports</option><option>Arts & Culture</option><option>Business</option><option>Community</option></select></Field><div className="sm:col-span-2"><Field label="Description" hint="A concise description shown on the public event page."><textarea required minLength={10} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What will attendees experience?" className="min-h-28 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" /></Field></div></div></section><section className="rounded-[2rem] border border-[#dedcd2] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ecf7c7] text-[#526b16]"><MapPin className="h-5 w-5" /></div><div><h2 className="font-semibold">Venue & schedule</h2><p className="text-sm text-[#68675d]">Where and when the moment happens.</p></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><Field label="Venue name"><Input required value={form.venueName} onChange={(event) => update("venueName", event.target.value)} placeholder="e.g. Main Arena" /></Field><Field label="Venue address"><Input required value={form.venueAddress} onChange={(event) => update("venueAddress", event.target.value)} placeholder="Street, city, country" /></Field><Field label="Starts"><Input required type="datetime-local" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} /></Field><Field label="Ends" hint="Choose a time after the start"><Input required min={form.startTime || undefined} type="datetime-local" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} aria-invalid={Boolean(scheduleError)} />{scheduleError && <span className="mt-2 block text-xs font-medium text-[#b45309]">{scheduleError}</span>}</Field></div></section><section className="rounded-[2rem] border border-[#dedcd2] bg-white p-6 sm:p-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff2dc] text-[#935b16]"><Ticket className="h-5 w-5" /></div><div><h2 className="font-semibold">Ticket setup</h2><p className="text-sm text-[#68675d]">Set a single standard price and available inventory.</p></div></div><div className="mt-7 grid gap-5 sm:grid-cols-3"><Field label="Ticket price" hint="USD per ticket"><Input required min="0" step="0.01" type="number" value={form.ticketPrice} onChange={(event) => update("ticketPrice", event.target.value)} /></Field><Field label="Number of slots" hint="Seats / tickets available"><Input required min="1" max="2000" type="number" value={form.ticketSlots} onChange={(event) => update("ticketSlots", event.target.value)} /></Field><Field label="Max per attendee" hint="Purchase limit"><Input required min="1" max="20" type="number" value={form.maxTicketsPerUser} onChange={(event) => update("maxTicketsPerUser", event.target.value)} /></Field></div></section><div className="flex flex-wrap justify-end gap-3"><Button type="button" onClick={() => submit(false)} disabled={createEvent.isPending || !canSubmit} variant="outline" className="h-12 rounded-full border-[#c7c5b9] bg-white px-6"><Save className="mr-2 h-4 w-4" /> Save draft</Button><Button type="button" onClick={() => submit(true)} disabled={createEvent.isPending || !canSubmit} className="h-12 rounded-full bg-[#7b3ff2] px-7 text-white hover:bg-[#6830d7]"><Rocket className="mr-2 h-4 w-4" /> Publish event</Button></div></div></section><aside className="space-y-6"><section className="sticky top-6 overflow-hidden rounded-[2rem] bg-[#171814] text-white"><div className="p-7"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ddff5a]">Live preview</p><h2 className="mt-5 text-3xl font-semibold leading-tight tracking-[-.06em]">{form.name || "Your event name"}</h2><p className="mt-3 line-clamp-4 text-sm leading-6 text-[#aaa99e]">{form.description || "Your event description will appear here."}</p><div className="mt-8 space-y-4 border-t border-white/10 pt-5 text-sm text-[#aaa99e]"><div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-[#ddff5a]" /> {previewDate}</div><div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-[#ddff5a]" /> {form.venueName || "Your venue"}</div><div className="flex items-center gap-3"><Ticket className="h-4 w-4 text-[#ddff5a]" /> ${Number(form.ticketPrice || 0).toFixed(2)} · {form.ticketSlots || 0} slots</div></div></div><div className="border-t border-white/10 bg-white/5 px-7 py-5"><div className="flex items-center justify-between text-sm"><span className="text-[#aaa99e]">Category</span><span className="text-[#ddff5a]">{form.category}</span></div></div></section><section className="rounded-[2rem] border border-[#dedcd2] bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#7b3ff2]">Your events</p><h2 className="mt-2 text-xl font-semibold">Manage publishing</h2></div><Users className="h-5 w-5 text-[#7b3ff2]" /></div><div className="mt-5 space-y-3">{eventsQuery.isLoading ? <p className="text-sm text-[#68675d]">Loading events…</p> : eventsQuery.data?.length ? eventsQuery.data.map((event) => <div key={event.id} className="rounded-xl bg-[#f7f5ef] p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{event.name}</p><p className="mt-1 text-xs text-[#68675d]">{new Date(event.startTime).toLocaleDateString()} · {event.capacity} slots</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${event.status === "PUBLISHED" ? "bg-[#ecf7c7] text-[#526b16]" : "bg-[#eeece5] text-[#68675d]"}`}>{event.status}</span></div>{event.status === "DRAFT" && <Button onClick={() => publish(event.id)} disabled={publishEvent.isPending} variant="ghost" className="mt-2 h-8 px-0 text-xs text-[#7b3ff2]">Publish now <ChevronRight className="ml-1 h-3 w-3" /></Button>}</div>) : <p className="text-sm leading-6 text-[#68675d]">Your created events will appear here.</p>}</div></section></aside></div></main></div>;
}
