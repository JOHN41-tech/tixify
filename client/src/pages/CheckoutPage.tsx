import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, CreditCard, Loader2, LockKeyhole, ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { countdownProgress, formatCountdown, secondsUntil } from "@/lib/countdown";

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const reservationId = Number(new URLSearchParams(window.location.search).get("reservation") ?? 0);
  const reservationQuery = trpc.reservations.get.useQuery({ reservationId }, { enabled: reservationId > 0 && Boolean(user), retry: false });
  const createBooking = trpc.bookings.create.useMutation();
  const createPayment = trpc.payments.create.useMutation();
  const verifyPayment = trpc.payments.verify.useMutation();
  const [seconds, setSeconds] = useState<number | null>(null);
  const [error, setError] = useState("");
  const reservation = reservationQuery.data;
  const remaining = seconds ?? 0;
  const isExpired = remaining <= 0;
  const progress = countdownProgress(remaining);
  const countdownTone = remaining <= 60 ? "text-[#ffb25c]" : "text-[#ddff5a]";
  const countdownLabel = useMemo(() => isExpired ? "Reservation expired" : `${formatCountdown(remaining)} remaining`, [isExpired, remaining]);

  useEffect(() => {
    const expiresAt = reservation?.expiresAt;
    if (!expiresAt) return;
    const update = () => setSeconds(secondsUntil(expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [reservation?.expiresAt]);
  useEffect(() => { if (!loading && !user) window.location.href = "/"; }, [loading, user]);

  const pay = async () => {
    setError("");
    try {
      const booking = await createBooking.mutateAsync({ reservationId, idempotencyKey: `booking-${reservationId}` });
      const payment = await createPayment.mutateAsync({ reservationId, outcome: "success", idempotencyKey: `payment-${reservationId}` });
      await verifyPayment.mutateAsync({ providerPaymentId: payment.providerPaymentId });
      setLocation(`/booking/${booking.bookingId}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Payment could not be verified. Your reservation remains protected until it expires."); }
  };

  if (reservationQuery.isLoading || loading) return <div className="grid min-h-screen place-items-center bg-[#f7f5ef]"><Loader2 className="h-6 w-6 animate-spin text-[#7b3ff2]" /></div>;
  if (!reservation) return <div className="grid min-h-screen place-items-center bg-[#f7f5ef] px-5 text-center"><div><p className="text-sm text-[#68675d]">Reservation not found or expired.</p><Link href="/events/1" className="mt-5 inline-block text-[#7b3ff2]">Choose another seat</Link></div></div>;
  const isBusy = createBooking.isPending || createPayment.isPending || verifyPayment.isPending;

  return <div className="min-h-screen bg-[#f7f5ef] text-[#171814]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10"><Link href="/" className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#171814] text-[#ddff5a]"><Ticket className="h-5 w-5" /></div><span className="text-xl font-semibold tracking-[-.04em]">tixify<span className="text-[#7b3ff2]">.</span></span></Link><span className="inline-flex items-center gap-2 text-sm text-[#68675d]"><ShieldCheck className="h-4 w-4 text-[#7b3ff2]" /> Secure checkout</span></header><main className="mx-auto max-w-5xl px-5 pb-20 lg:px-10"><Link href={`/events/${reservation.eventId}`} className="mb-8 inline-flex items-center gap-2 text-sm text-[#68675d] hover:text-[#171814]"><ArrowLeft className="h-4 w-4" /> Back to seat map</Link><div className="grid gap-6 lg:grid-cols-[1fr_380px]"><section className="rounded-[2rem] bg-[#171814] p-7 text-white sm:p-10"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#ddff5a]">Almost there</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.06em]">Finish your<br />booking.</h1><div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-start justify-between"><div><p className="text-lg font-medium">{reservation.eventName}</p><p className="mt-1 text-sm text-[#aaa99e]">Reservation #{reservation.id}</p></div><span className="rounded-full bg-[#ddff5a] px-3 py-1 text-xs font-semibold text-[#171814]">HELD</span></div><div className="mt-7 grid gap-3 text-sm text-[#aaa99e]"><div className="flex items-center justify-between"><span>Seats</span><span className="text-white">{reservation.items.map((item) => `${item.section}${item.number}`).join(", ")}</span></div><div className="flex items-center justify-between"><span>Ticket hold</span><span className="text-white">{countdownLabel}</span></div><div className="mt-3 border-t border-white/10 pt-4"><div className="flex items-center justify-between text-base"><span className="text-white">Total</span><span className="text-xl font-semibold text-[#ddff5a]">${Number(reservation.totalAmount).toFixed(2)}</span></div></div></div></div><p className="mt-8 text-sm leading-6 text-[#aaa99e]">Your seats are reserved server-side. Payment verification completes the booking and issues your tickets.</p></section><section className="rounded-[2rem] border border-[#dedcd2] bg-white p-7 sm:p-8"><div className={`rounded-2xl border p-5 ${remaining <= 60 ? "border-[#e6a04f]/50 bg-[#fff2dc]" : "border-[#d9e99b] bg-[#f5fadf]"}`} aria-live="polite"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#68675d]">Reservation expires in</p><p className={`mt-1 text-4xl font-semibold tracking-[-.06em] ${countdownTone}`}>{countdownLabel}</p></div><Clock3 className={`h-6 w-6 ${countdownTone}`} /></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10"><div className={`h-full rounded-full transition-[width] duration-1000 ${remaining <= 60 ? "bg-[#e6a04f]" : "bg-[#7b3ff2]"}`} style={{ width: `${progress}%` }} /></div><p className="mt-3 text-xs text-[#68675d]">Complete payment before the timer reaches zero.</p></div><div className="mt-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0effa] text-[#7b3ff2]"><CreditCard className="h-5 w-5" /></div><div><h2 className="font-semibold">Mock payment</h2><p className="text-sm text-[#68675d]">Development checkout</p></div></div><div className="mt-6 space-y-4"><div className="rounded-xl border border-[#dedcd2] bg-[#f7f5ef] px-4 py-3 text-sm text-[#68675d]">4242 4242 4242 4242 <span className="float-right">12/28 · 123</span></div><div className="rounded-xl border border-[#dedcd2] px-4 py-3 text-sm text-[#68675d]">Name on card <span className="float-right text-[#171814]">{user?.name ?? "Demo User"}</span></div></div>{error && <p className="mt-5 rounded-xl bg-[#fff2dc] px-4 py-3 text-sm text-[#935b16]">{error}</p>}<Button onClick={pay} disabled={isExpired || isBusy} className="mt-8 h-12 w-full rounded-full bg-[#7b3ff2] text-white hover:bg-[#6830d7]">{isBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying payment…</> : isExpired ? <><CircleAlert className="mr-2 h-4 w-4" /> Reservation expired</> : <><LockKeyhole className="mr-2 h-4 w-4" /> Pay ${Number(reservation.totalAmount).toFixed(2)}</>}</Button><p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-[#aaa99e]"><CheckCircle2 className="h-3.5 w-3.5 text-[#7b3ff2]" /> No card is charged in demo mode</p></section></div></main></div>;
}
