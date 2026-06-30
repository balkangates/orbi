"use client";

import { useActionState, useEffect, useState, useCallback } from "react";
import { createReservationAction, type FormState } from "@/lib/actions";

type Quote = {
  ok: boolean;
  error?: string;
  available?: boolean;
  nights: number;
  subtotal: number;
  geniusPercent: number;
  geniusDiscount: number;
  couponDiscount: number;
  couponCode: string | null;
  total: number;
  avgPerNight: number;
};

const m = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export function BookingWidget({
  apartmentId,
  basePrice,
  maxGuests,
  defaultCheckIn,
  defaultCheckOut,
  user,
}: {
  apartmentId: number;
  basePrice: number;
  maxGuests: number;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  user: { fullName: string; email: string; phone: string; geniusLevel: number } | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [checkIn, setCheckIn] = useState(defaultCheckIn || today);
  const [checkOut, setCheckOut] = useState(
    defaultCheckOut || new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
  );
  const [guests, setGuests] = useState(2);
  const [couponCode, setCouponCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(createReservationAction, {});

  const fetchQuote = useCallback(async () => {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setQuote(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apartmentId, checkIn, checkOut, couponCode }),
      });
      setQuote(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apartmentId, checkIn, checkOut, couponCode]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  return (
    <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-5 shadow-md">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-slate-900">{m(basePrice)}</span>
        <span className="text-sm text-slate-500">/ gece (baz fiyat)</span>
      </div>
      {user && user.geniusLevel > 0 && (
        <div className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
          Genius {user.geniusLevel} indiriminiz uygulanır
        </div>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="apartmentId" value={apartmentId} />
        <input type="hidden" name="checkIn" value={checkIn} />
        <input type="hidden" name="checkOut" value={checkOut} />
        <input type="hidden" name="guests" value={guests} />
        <input type="hidden" name="couponCode" value={couponCode} />

        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300">
          <label className="border-r border-slate-300 p-2">
            <span className="block text-[11px] font-semibold text-slate-500">GİRİŞ</span>
            <input
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full text-sm outline-none"
            />
          </label>
          <label className="p-2">
            <span className="block text-[11px] font-semibold text-slate-500">ÇIKIŞ</span>
            <input
              type="date"
              value={checkOut}
              min={checkIn}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full text-sm outline-none"
            />
          </label>
        </div>

        <label className="block rounded-lg border border-slate-300 p-2">
          <span className="block text-[11px] font-semibold text-slate-500">MİSAFİR</span>
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full text-sm outline-none">
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} misafir
              </option>
            ))}
          </select>
        </label>

        <input
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          placeholder="Kupon kodu (WELCOME10)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-[#0071c2]"
        />

        {/* Price breakdown */}
        {loading && <div className="text-sm text-slate-500">Fiyat hesaplanıyor…</div>}
        {quote && quote.ok && (
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            {quote.available === false && (
              <div className="mb-2 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                ⚠️ Bu tarihler dolu
              </div>
            )}
            <div className="flex justify-between">
              <span>
                {m(quote.avgPerNight)} × {quote.nights} gece
              </span>
              <span>{m(quote.subtotal)}</span>
            </div>
            {quote.geniusDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Genius indirimi (%{quote.geniusPercent})</span>
                <span>−{m(quote.geniusDiscount)}</span>
              </div>
            )}
            {quote.couponDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Kupon ({quote.couponCode})</span>
                <span>−{m(quote.couponDiscount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
              <span>Toplam</span>
              <span>{m(quote.total)}</span>
            </div>
          </div>
        )}
        {quote && quote.error && <div className="text-sm text-red-600">{quote.error}</div>}

        {/* Guest info */}
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <input
            name="guestName"
            defaultValue={user?.fullName}
            placeholder="Ad Soyad *"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <input
            name="guestEmail"
            type="email"
            defaultValue={user?.email}
            placeholder="E-posta *"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <input
            name="guestPhone"
            defaultValue={user?.phone}
            placeholder="Telefon"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
          <textarea
            name="note"
            placeholder="Özel istek (opsiyonel)"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0071c2]"
          />
        </div>

        {state.error && (
          <div className="rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700">{state.error}</div>
        )}

        <button
          type="submit"
          disabled={pending || quote?.available === false}
          className="w-full rounded-lg bg-amber-400 px-4 py-3 text-base font-bold text-[#003580] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "İşleniyor…" : "Rezervasyonu Onayla"}
        </button>
        <p className="text-center text-xs text-slate-400">Anında onay · Ücretsiz iptal 48 saat öncesine kadar</p>
      </form>
    </div>
  );
}
