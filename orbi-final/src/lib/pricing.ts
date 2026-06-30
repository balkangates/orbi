import { db } from "@/db";
import { pricingRules } from "@/db/schema";
import { eq, or, isNull } from "drizzle-orm";

export type PricingRule = {
  ruleType: string;
  startDate: string | null;
  endDate: string | null;
  multiplier: string;
  priority: number;
  active: boolean;
  apartmentId: number | null;
};

function dateInRange(d: Date, start: string | null, end: string | null): boolean {
  if (start && d < new Date(start + "T00:00:00Z")) return false;
  if (end && d > new Date(end + "T00:00:00Z")) return false;
  return true;
}

// Compute multiplier for a single night using the highest-priority matching rule
// of each type, multiplied together (season * weekend * lastminute).
export function nightMultiplier(
  date: Date,
  rules: PricingRule[],
  todayMs: number,
): number {
  let mult = 1;
  const day = date.getUTCDay(); // 0 Sun .. 6 Sat
  const isWeekend = day === 5 || day === 6; // Fri, Sat

  // season
  const season = rules
    .filter((r) => r.active && r.ruleType === "season" && dateInRange(date, r.startDate, r.endDate))
    .sort((a, b) => b.priority - a.priority)[0];
  if (season) mult *= parseFloat(season.multiplier);

  // weekend
  if (isWeekend) {
    const weekend = rules.filter((r) => r.active && r.ruleType === "weekend")[0];
    if (weekend) mult *= parseFloat(weekend.multiplier);
  }

  // last-minute (check-in within 3 days)
  const daysUntil = Math.round((date.getTime() - todayMs) / (1000 * 60 * 60 * 24));
  if (daysUntil >= 0 && daysUntil <= 3) {
    const lm = rules.filter((r) => r.active && r.ruleType === "lastminute")[0];
    if (lm) mult *= parseFloat(lm.multiplier);
  }

  return mult;
}

export type NightlyBreakdown = { date: string; price: number; multiplier: number };

export function computeNightly(
  basePrice: number,
  checkIn: string,
  checkOut: string,
  rules: PricingRule[],
): { nights: NightlyBreakdown[]; subtotal: number; avgPerNight: number } {
  const nights: NightlyBreakdown[] = [];
  const todayMs = Date.now();
  const start = new Date(checkIn + "T00:00:00Z");
  const end = new Date(checkOut + "T00:00:00Z");
  let subtotal = 0;
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const m = nightMultiplier(new Date(d), rules, todayMs);
    const price = Math.round(basePrice * m * 100) / 100;
    nights.push({ date: d.toISOString().slice(0, 10), price, multiplier: Math.round(m * 100) / 100 });
    subtotal += price;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const avg = nights.length ? Math.round((subtotal / nights.length) * 100) / 100 : basePrice;
  return { nights, subtotal, avgPerNight: avg };
}

export async function loadRulesForApartment(apartmentId: number): Promise<PricingRule[]> {
  const rows = await db
    .select()
    .from(pricingRules)
    .where(or(isNull(pricingRules.apartmentId), eq(pricingRules.apartmentId, apartmentId)));
  return rows.map((r) => ({
    ruleType: r.ruleType,
    startDate: r.startDate,
    endDate: r.endDate,
    multiplier: r.multiplier,
    priority: r.priority,
    active: r.active,
    apartmentId: r.apartmentId,
  }));
}
