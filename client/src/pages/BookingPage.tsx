import { Link, useRoute } from "wouter";
import { ArrowRight, CalendarDays, CheckCircle2, Download, MapPin, Ticket as TicketIcon } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import TicketQr from "@/components/TicketQr";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export default function BookingPage() {
  const [, params] = useRoute("/booking/:bookingId");
  const bookingId = Number(params?.bookingId ?? 0);
  const { data, isLoading } = trpc.bookings.get.useQuery({ bookingId }, { enabled: bookingId > 0, retry: false });

  const downloadPass = async () => {
    if (!data) return;
    const origin = window.location.origin;
    const ticketMarkup = await Promise.all(data.tickets.map(async (ticket) => {
      const code = escapeHtml(ticket.publicCode);
      const url = `${origin}/ticket/${encodeURIComponent(ticket.publicCode)}`;
      const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 220, color: { dark: "#171814", light: "#ddff5a" } });
      return `<article class="ticket"><div><p class="eyebrow">${escapeHtml(data.eventName)}</p><h2>${code}</h2><p>Seat ${escapeHtml(ticket.section)}${ticket.number} · ${escapeHtml(ticket.seatType)}</p><p>${escapeHtml(data.venueName)}<br>${new Date(data.startTime).toLocaleString()}</p></div><img src="${qr}" alt="QR code for ${code}"><small>Scan at entrance</small></article>`;
    }));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tixify booking ${data.id}</title><style>body{margin:0;background:#f7f5ef;color:#171814;font-family:Arial,sans-serif;padding:40px}.wrap{max-width:760px;margin:auto}.brand{font-size:24px;font-weight:700;margin-bottom:32px}.ticket{display:flex;align-items:center;justify-content:space-between;gap:30px;background:#171814;color:#fff;border-radius:24px;padding:32px;margin:18px 0}.ticket img{width:180px;height:180px;background:#ddff5a;border-radius:16px;padding:10px}.ticket small{color:#ddff5a;text-transform:uppercase;letter-spacing:.15em}.eyebrow{color:#ddff5a;text-transform:uppercase;letter-spacing:.2em;font-size:12px;font-weight:700}.ticket h2{font-family:monospace;color:#ddff5a}.ticket p{line-height:1.6;color:#c4c3b8}@media print{body{padding:0}.ticket{break-inside:avoid}}</style></head><body><div class="wrap"><div class="brand">tixify.</div><h1>Your access pass</h1><p>Booking #${data.id} · ${escapeHtml(data.eventName)}</p>${ticketMarkup.join("")}</div></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tixify-booking-${data.id}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f5ef]">Loading your booking…</div>;
  if (!data) return <div className="grid min-h-screen place-items-center bg-[#f7f5ef] px-5 text-center"><div><p>Booking not found.</p><Link href="/events/1" className="mt-4 inline-block text-[#7b3ff2]">Back to events</Link></div></div>;
  const firstTicket = data.tickets[0];
  const ticketUrl = firstTicket && typeof window !== "undefined" ? `${window.location.origin}/ticket/${encodeURIComponent(firstTicket.publicCode)}` : "";

  return <div className="min-h-screen bg-[#f7f5ef] text-[#171814]"><header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 lg:px-10"><Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#171814] text-[#ddff5a]"><TicketIcon className="h-5 w-5" /></div><span className="text-xl font-semibold tracking-[-.04em]">tixify<span className="text-[#7b3ff2]">.</span></span></Link><Link href="/tickets" className="text-sm text-[#68675d] hover:text-[#171814]">My tickets</Link></header><main className="mx-auto max-w-4xl px-5 pb-20 pt-10 lg:px-10"><div className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#ddff5a] text-[#171814]"><CheckCircle2 className="h-8 w-8" /></div><p className="mt-7 text-xs font-semibold uppercase tracking-[.2em] text-[#7b3ff2]">Booking confirmed</p><h1 className="mt-3 text-5xl font-semibold tracking-[-.07em] sm:text-7xl">You’re in.</h1><p className="mx-auto mt-5 max-w-md text-[#68675d]">Your payment is verified and your tickets are ready. Show the code at the door.</p></div><section className="mt-14 overflow-hidden rounded-[2rem] bg-[#171814] text-white"><div className="grid gap-8 p-7 sm:grid-cols-[1fr_220px] sm:p-10"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#ddff5a]">{data.eventName}</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.05em]">Your access pass</h2><div className="mt-8 space-y-4 text-sm text-[#aaa99e]"><div className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-[#ddff5a]" /> {new Date(data.startTime).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}</div><div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-[#ddff5a]" /> {data.venueName}</div></div></div>{firstTicket && ticketUrl && <div className="rounded-2xl bg-[#ddff5a] p-4 text-center text-[#171814]"><TicketQr value={ticketUrl} size={190} /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.2em]">Scan to open ticket</p></div>}</div><div className="border-t border-white/10 px-7 py-5 sm:px-10"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-[#aaa99e]">Ticket codes</p><div className="mt-2 flex flex-wrap gap-2">{data.tickets.map((ticket) => <span key={ticket.id} className="rounded-full bg-white/10 px-3 py-1.5 font-mono text-xs text-[#ddff5a]">{ticket.publicCode}</span>)}</div></div><Button type="button" onClick={downloadPass} variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10"><Download className="mr-2 h-4 w-4" /> Download pass</Button></div></div></section><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/events/1"><Button variant="outline" className="rounded-full border-[#d5d2c8]">Book another event</Button></Link><Link href="/tickets"><Button className="rounded-full bg-[#171814] text-white hover:bg-[#7b3ff2]">View all tickets <ArrowRight className="ml-2 h-4 w-4" /></Button></Link></div></main></div>;
}
