import { db } from "@/db";
import { apartments, reservations, coupons } from "@/db/schema";
import { and, eq, lt, gt, ne } from "drizzle-orm";
import { computeNightly, loadRulesForApartment } from "@/lib/pricing";
import { geniusDiscountPercent } from "@/lib/genius";
import { nightsBetween } from "@/lib/format";

export type QuoteResult = {
  ok: boolean;
  error?: string;
  apartmentId: number;
  basePrice: number;
  nights: number;
  subtotal: number;
  geniusPercent: number;
  geniusDiscount: number;
  couponDiscount: number;
  couponId: number | null;
  couponCode: string | null;
  total: number;
  avgPerNight: number;
  breakdown: { date: string; price: number; multiplier: number }[];
};

// Returns true if the apartment is free for the given range (exclusive of checkout day).
export async function isAvailable(
  apartmentId: number,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: number,
): Promise<boolean> {
  const conditions = [
    eq(reservations.apartmentId, apartmentId),
    ne(reservations.status, "cancelled"),
    // overlap: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
    lt(reservations.checkIn, checkOut),
    gt(reservations.checkOut, checkIn),
  ];
  if (excludeReservationId) conditions.push(ne(reservations.id, excludeReservationId));
  const rows = await db
    .select({ id: reservations.id })
    .from(reservations)
    .where(and(...conditions))
    .limit(1);
  return rows.length === 0;
}

export async function buildQuote(opts: {
  apartmentId: number;
  checkIn: string;
  checkOut: string;
  geniusLevel?: number;
  couponCode?: string | null;
}): Promise<QuoteResult> {
  const { apartmentId, checkIn, checkOut } = opts;
  const empty: QuoteResult = {
    ok: false,
    apartmentId,
    basePrice: 0,
    nights: 0,
    subtotal: 0,
    geniusPercent: 0,
    geniusDiscount: 0,
    couponDiscount: 0,
    couponId: null,
    couponCode: null,
    total: 0,
    avgPerNight: 0,
    breakdown: [],
  };

  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0) return { ...empty, error: "Geçersiz tarih aralığı" };

  const apt = (await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1))[0];
  if (!apt) return { ...empty, error: "Daire bulunamadı" };

  const basePrice = parseFloat(apt.basePrice);
  const rules = await loadRulesForApartment(apartmentId);
  const { nights: breakdown, subtotal, avgPerNight } = computeNightly(basePrice, checkIn, checkOut, rules);

  const geniusPercent = geniusDiscountPercent(opts.geniusLevel ?? 0);
  const geniusDiscount = Math.round(subtotal * (geniusPercent / 100) * 100) / 100;

  let couponDiscount = 0;
  let couponId: number | null = null;
  let couponCode: string | null = null;
  if (opts.couponCode) {
    const code = opts.couponCode.trim().toUpperCase();
    const c = (await db.select().from(coupons).where(eq(coupons.code, code)).limit(1))[0];
    const today = new Date();
    if (
      c &&
      c.active &&
      c.usedCount < c.maxUses &&
      nights >= c.minNights &&
      (!c.validFrom || new Date(c.validFrom) <= today) &&
      (!c.validTo || new Date(c.validTo) >= today)
    ) {
      const base = subtotal - geniusDiscount;
      if (c.discountType === "percent") {
        couponDiscount = Math.round(base * (parseFloat(c.discountValue) / 100) * 100) / 100;
      } else {
        couponDiscount = Math.min(base, parseFloat(c.discountValue));
      }
      couponId = c.id;
      couponCode = c.code;
    }
  }

  const total = Math.max(0, Math.round((subtotal - geniusDiscount - couponDiscount) * 100) / 100);

  return {
    ok: true,
    apartmentId,
    basePrice,
    nights,
    subtotal,
    geniusPercent,
    geniusDiscount,
    couponDiscount,
    couponId,
    couponCode,
    total,
    avgPerNight,
    breakdown,
  };
}

export function generateReference(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `OCB-${n}`;
}


