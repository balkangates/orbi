import "dotenv/config";
import { db, pool } from "./index";
import { sql } from "drizzle-orm";
import {
  users,
  blocks,
  apartmentTypes,
  amenities,
  facilities,
  apartments,
  apartmentImages,
  apartmentAmenities,
  pricingRules,
  coupons,
  reviews,
  geniusLevels,
} from "./schema";
import { hashPassword } from "../lib/auth";
import { GENIUS_TIERS } from "../lib/genius";

const INTERIORS = [
  "https://images.pexels.com/photos/8135492/pexels-photo-8135492.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/7167073/pexels-photo-7167073.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/8082227/pexels-photo-8082227.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/7546323/pexels-photo-7546323.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/7173666/pexels-photo-7173666.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/8135496/pexels-photo-8135496.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/6920439/pexels-photo-6920439.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/8135503/pexels-photo-8135503.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/7174113/pexels-photo-7174113.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
];
const SEAVIEWS = [
  "https://images.pexels.com/photos/14286298/pexels-photo-14286298.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/7614416/pexels-photo-7614416.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/20221437/pexels-photo-20221437.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/32178290/pexels-photo-32178290.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  "https://images.pexels.com/photos/15885495/pexels-photo-15885495.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const rand = (n: number) => Math.floor(Math.random() * n);

async function main() {
  console.log("Resetting tables...");
  await db.execute(sql`
    TRUNCATE TABLE
      reviews, notifications, sessions, reservations, apartment_amenities,
      apartment_images, pricing_rules, apartments, amenities, facilities,
      apartment_types, blocks, coupons, genius_levels, users
    RESTART IDENTITY CASCADE
  `);

  // Users
  console.log("Users...");
  const [admin, guest] = await db
    .insert(users)
    .values([
      {
        email: "admin@orbicity.com",
        passwordHash: hashPassword("admin123"),
        fullName: "Orbi City Admin",
        phone: "+995 555 000 000",
        role: "admin",
      },
      {
        email: "guest@orbicity.com",
        passwordHash: hashPassword("guest123"),
        fullName: "Demo Guest",
        phone: "+90 555 111 222",
        role: "guest",
        geniusLevel: 2,
        totalReservations: 6,
      },
    ])
    .returning();

  // Blocks
  console.log("Blocks...");
  const blockRows = await db
    .insert(blocks)
    .values([
      { code: "A", name: "Orbi City — Blok A", description: "Deniz cephesi, ana giriş ve resepsiyon.", floors: 45 },
      { code: "B", name: "Orbi City — Blok B", description: "Havuz ve spa katlarına yakın orta blok.", floors: 45 },
      { code: "C", name: "Orbi City — Blok C", description: "Bulvar manzaralı, restoran ve cafe katı.", floors: 45 },
    ])
    .returning();

  // Genius levels
  await db.insert(geniusLevels).values(
    GENIUS_TIERS.map((t) => ({
      level: t.level,
      name: t.name,
      minReservations: t.minReservations,
      discountPercent: t.discountPercent,
      perks: t.perks.join(", "),
    })),
  );

  // Amenities
  console.log("Amenities...");
  const amenityDefs = [
    { name: "Ücretsiz WiFi", icon: "📶", category: "internet" },
    { name: "Klima", icon: "❄️", category: "comfort" },
    { name: "Tam Donanımlı Mutfak", icon: "🍳", category: "kitchen" },
    { name: "Bulaşık Makinesi", icon: "🍽️", category: "kitchen" },
    { name: "Çamaşır Makinesi", icon: "🧺", category: "comfort" },
    { name: "Smart TV", icon: "📺", category: "entertainment" },
    { name: "Deniz Manzarası", icon: "🌊", category: "view" },
    { name: "Balkon", icon: "🌅", category: "view" },
    { name: "Jakuzi", icon: "🛁", category: "luxury" },
    { name: "Kasa", icon: "🔒", category: "safety" },
    { name: "Saç Kurutma Makinesi", icon: "💨", category: "bathroom" },
    { name: "Ütü", icon: "👕", category: "comfort" },
    { name: "Bebek Yatağı", icon: "🍼", category: "family" },
    { name: "Oda Servisi", icon: "🛎️", category: "service" },
  ];
  const amenityRows = await db.insert(amenities).values(amenityDefs).returning();
  const amId = (name: string) => amenityRows.find((a) => a.name === name)!.id;

  // Facilities
  console.log("Facilities...");
  await db.insert(facilities).values([
    { name: "Resepsiyon", description: "24 saat çok dilli karşılama ve check-in.", icon: "🛎️", hours: "24/7", sortOrder: 1 },
    { name: "Spa & Hamam", description: "Masaj, sauna ve geleneksel hamam.", icon: "💆", hours: "09:00 - 22:00", sortOrder: 2 },
    { name: "Fitness Center", description: "Tam donanımlı modern spor salonu.", icon: "🏋️", hours: "06:00 - 23:00", sortOrder: 3 },
    { name: "Kapalı & Açık Havuz", description: "Isıtmalı kapalı havuz ve panoramik açık havuz.", icon: "🏊", hours: "08:00 - 21:00", sortOrder: 4 },
    { name: "Restoran", description: "Dünya ve Gürcü mutfağı à la carte restoran.", icon: "🍽️", hours: "07:00 - 23:00", sortOrder: 5 },
    { name: "Lobby Cafe", description: "Taze kahve, tatlı ve atıştırmalıklar.", icon: "☕", hours: "08:00 - 24:00", sortOrder: 6 },
    { name: "Casino", description: "Lisanslı oyun ve eğlence katı.", icon: "🎰", hours: "18:00 - 04:00", sortOrder: 7 },
    { name: "Market", description: "Tesis içi 24 saat market.", icon: "🛒", hours: "24/7", sortOrder: 8 },
    { name: "ATM", description: "Çoklu para birimi ATM noktaları.", icon: "🏧", hours: "24/7", sortOrder: 9 },
    { name: "Kapalı Otopark", description: "Güvenli vale ve self parking.", icon: "🅿️", hours: "24/7", sortOrder: 10 },
    { name: "Concierge", description: "Tur, bilet ve rezervasyon hizmeti.", icon: "🤵", hours: "08:00 - 22:00", sortOrder: 11 },
    { name: "Havalimanı Transfer", description: "Batumi havalimanına özel transfer.", icon: "🚐", hours: "Talebe göre", sortOrder: 12 },
    { name: "Çamaşırhane", description: "Profesyonel kuru temizleme ve çamaşır.", icon: "🧺", hours: "09:00 - 20:00", sortOrder: 13 },
    { name: "Kids Area", description: "Çocuk oyun alanı ve mini kulüp.", icon: "🧸", hours: "10:00 - 20:00", sortOrder: 14 },
  ]);

  // Pricing rules (global)
  console.log("Pricing rules...");
  await db.insert(pricingRules).values([
    { name: "Yaz Sezonu", ruleType: "season", startDate: "2026-06-15", endDate: "2026-09-15", multiplier: "1.40", priority: 10 },
    { name: "Kış İndirimi", ruleType: "season", startDate: "2026-12-01", endDate: "2027-02-28", multiplier: "0.85", priority: 5 },
    { name: "Yılbaşı Yüksek Sezon", ruleType: "season", startDate: "2026-12-28", endDate: "2027-01-05", multiplier: "1.60", priority: 20 },
    { name: "Hafta Sonu", ruleType: "weekend", multiplier: "1.10", priority: 0 },
    { name: "Son Dakika", ruleType: "lastminute", multiplier: "0.90", priority: 0 },
  ]);

  // Coupons
  console.log("Coupons...");
  await db.insert(coupons).values([
    { code: "WELCOME10", discountType: "percent", discountValue: "10", minNights: 1, maxUses: 5000 },
    { code: "ORBI20", discountType: "percent", discountValue: "20", minNights: 3, maxUses: 2000 },
    { code: "SUMMER25", discountType: "percent", discountValue: "25", minNights: 5, validFrom: "2026-06-01", validTo: "2026-09-30", maxUses: 1000 },
    { code: "STAY7", discountType: "fixed", discountValue: "60", minNights: 7, maxUses: 1000 },
  ]);

  // Apartment types
  console.log("Types & apartments...");
  const typeDefs = [
    { code: "studio", name: "Studio (1+0)", bedrooms: 0, bathrooms: 1, maxGuests: 2, sizeSqm: 32, base: 55, count: 40 },
    { code: "1+1", name: "1+1 Daire", bedrooms: 1, bathrooms: 1, maxGuests: 3, sizeSqm: 48, base: 75, count: 50 },
    { code: "2+1", name: "2+1 Daire", bedrooms: 2, bathrooms: 2, maxGuests: 5, sizeSqm: 72, base: 110, count: 30 },
    { code: "3+1", name: "3+1 Daire", bedrooms: 3, bathrooms: 2, maxGuests: 7, sizeSqm: 95, base: 150, count: 15 },
    { code: "penthouse", name: "Penthouse", bedrooms: 3, bathrooms: 3, maxGuests: 6, sizeSqm: 140, base: 260, count: 6 },
    { code: "loft", name: "Loft", bedrooms: 1, bathrooms: 1, maxGuests: 3, sizeSqm: 60, base: 130, count: 5 },
    { code: "duplex", name: "Duplex", bedrooms: 2, bathrooms: 2, maxGuests: 5, sizeSqm: 110, base: 190, count: 4 },
  ];
  const typeRows = await db
    .insert(apartmentTypes)
    .values(
      typeDefs.map((t) => ({
        code: t.code,
        name: t.name,
        bedrooms: t.bedrooms,
        bathrooms: t.bathrooms,
        maxGuests: t.maxGuests,
        sizeSqm: t.sizeSqm,
      })),
    )
    .returning();
  const typeId = (code: string) => typeRows.find((t) => t.code === code)!.id;

  const reviewNames = ["Ahmet Y.", "Maria K.", "Giorgi B.", "Elena P.", "Mehmet D.", "Anna S.", "David L.", "Nino T.", "Olga R.", "Kaan A."];
  const reviewTexts = [
    "Harika deniz manzarası, çok temiz ve konforlu. Kesinlikle tekrar geleceğiz!",
    "Konum mükemmel, plaja çok yakın. Resepsiyon ekibi çok ilgiliydi.",
    "Daire fotoğraflardaki gibiydi. Mutfak tam donanımlı, her şey düşünülmüş.",
    "Spa ve havuz muhteşemdi. Genius indirimi ile çok uygun oldu.",
    "Geniş ve ferah bir daire. Aile tatili için ideal.",
    "Manzara nefes kesici. Akşamları balkonda oturmak bir ayrıcalık.",
  ];

  let counter = 0;
  const allApartments: { id: number; seaView: boolean }[] = [];

  for (const t of typeDefs) {
    const rows = [];
    for (let i = 0; i < t.count; i++) {
      const block = pick(blockRows, counter);
      const floor = 3 + (counter % 42);
      const unit = (counter % 8) + 1;
      const seaView = floor >= 18 || t.code === "penthouse" || t.code === "duplex" || i % 3 === 0;
      const price = Math.round(t.base + floor * 0.9 + (seaView ? 25 : 0));
      const cover = seaView ? pick(SEAVIEWS, counter) : pick(INTERIORS, counter);
      rows.push({
        code: `${block.code}-${floor}${String(unit).padStart(2, "0")}`,
        name: `${t.name} · Blok ${block.code} · Kat ${floor}`,
        blockId: block.id,
        typeId: typeId(t.code),
        floor,
        description: `Orbi City Batumi ${block.code} blokunda ${floor}. katta yer alan ${t.sizeSqm} m² ${t.name}. ${seaView ? "Panoramik Karadeniz manzarası, " : ""}modern mobilyalar ve tam donanımlı mutfak ile keyifli bir konaklama sunar.`,
        rules: "Check-in 14:00 · Check-out 12:00 · Sigara içilmez · Evcil hayvan kabul edilmez · Sessizlik saatleri 23:00-08:00",
        basePrice: String(price),
        maxGuests: t.maxGuests,
        bedrooms: t.bedrooms,
        bathrooms: t.bathrooms,
        sizeSqm: t.sizeSqm,
        seaView,
        coverImage: cover,
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        tour360Url: "https://momento360.com/e/u/3d4cdda4f0fb4a0d8c0a8df5b3a1f2c7",
        status: "active",
      });
      counter++;
    }
    const inserted = await db.insert(apartments).values(rows).returning();

    // images, amenities, reviews per apartment
    for (let idx = 0; idx < inserted.length; idx++) {
      const apt = inserted[idx];
      allApartments.push({ id: apt.id, seaView: apt.seaView });

      // gallery (4 images)
      const gallery = apt.seaView
        ? [apt.coverImage, pick(INTERIORS, idx), pick(INTERIORS, idx + 3), pick(SEAVIEWS, idx + 1)]
        : [apt.coverImage, pick(INTERIORS, idx + 1), pick(INTERIORS, idx + 4), pick(SEAVIEWS, idx)];
      await db.insert(apartmentImages).values(
        gallery.map((url, o) => ({ apartmentId: apt.id, url, sortOrder: o })),
      );

      // amenities
      const baseAmenities = ["Ücretsiz WiFi", "Klima", "Tam Donanımlı Mutfak", "Smart TV", "Saç Kurutma Makinesi", "Kasa"];
      if (apt.seaView) baseAmenities.push("Deniz Manzarası", "Balkon");
      if (t.bedrooms >= 2) baseAmenities.push("Bulaşık Makinesi", "Çamaşır Makinesi", "Bebek Yatağı");
      if (["penthouse", "loft", "duplex"].includes(t.code)) baseAmenities.push("Jakuzi", "Oda Servisi", "Ütü");
      const uniqueAm = [...new Set(baseAmenities)];
      await db.insert(apartmentAmenities).values(
        uniqueAm.map((name) => ({ apartmentId: apt.id, amenityId: amId(name) })),
      );

      // reviews (1-4)
      const nReviews = 1 + rand(4);
      let sum = 0;
      const reviewRows = [];
      for (let r = 0; r < nReviews; r++) {
        const rating = 4 + rand(2); // 4 or 5
        sum += rating;
        reviewRows.push({
          apartmentId: apt.id,
          userId: r === 0 ? guest.id : null,
          authorName: pick(reviewNames, idx + r),
          rating,
          cleanliness: 4 + rand(2),
          location: 5,
          value: 4 + rand(2),
          comment: pick(reviewTexts, idx + r),
        });
      }
      await db.insert(reviews).values(reviewRows);
      const avg = (sum / nReviews).toFixed(2);
      await db
        .update(apartments)
        .set({ rating: avg, reviewCount: nReviews })
        .where(sql`id = ${apt.id}`);
    }
  }

  console.log(`Seeded ${counter} apartments. Admin: ${admin.email}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
