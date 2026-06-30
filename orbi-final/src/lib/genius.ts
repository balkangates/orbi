// Genius loyalty configuration & resolver.
// Level 1: 2 reservations  -> 10%
// Level 2: 5 reservations  -> 15% + Late Checkout
// Level 3: 15 reservations -> 20% + VIP + Transfer
export type GeniusTier = {
  level: number;
  name: string;
  minReservations: number;
  discountPercent: number;
  perks: string[];
};

export const GENIUS_TIERS: GeniusTier[] = [
  { level: 0, name: "Explorer", minReservations: 0, discountPercent: 0, perks: ["Standart fiyatlar"] },
  { level: 1, name: "Genius Level 1", minReservations: 2, discountPercent: 10, perks: ["%10 indirim"] },
  {
    level: 2,
    name: "Genius Level 2",
    minReservations: 5,
    discountPercent: 15,
    perks: ["%15 indirim", "Geç çıkış (Late Checkout)"],
  },
  {
    level: 3,
    name: "Genius Level 3",
    minReservations: 15,
    discountPercent: 20,
    perks: ["%20 indirim", "VIP karşılama", "Ücretsiz havalimanı transferi"],
  },
];

export function levelFromReservations(count: number): number {
  let level = 0;
  for (const tier of GENIUS_TIERS) {
    if (count >= tier.minReservations) level = tier.level;
  }
  return level;
}

export function tierFor(level: number): GeniusTier {
  return GENIUS_TIERS.find((t) => t.level === level) ?? GENIUS_TIERS[0];
}

export function geniusDiscountPercent(level: number): number {
  return tierFor(level).discountPercent;
}
