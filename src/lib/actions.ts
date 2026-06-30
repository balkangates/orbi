"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, reservations, reviews, notifications, apartments, coupons } from "@/db/schema";
import { eq, sql, and, avg, count } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getCurrentUser,
} from "@/lib/auth";
import { buildQuote, isAvailable, generateReference } from "@/lib/quote";
import { levelFromReservations, tierFor } from "@/lib/genius";

export type FormState = { error?: string; ok?: boolean };

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "E-posta ve şifre gerekli." };
  const u = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (!u || !verifyPassword(password, u.passwordHash)) return { error: "Geçersiz e-posta veya şifre." };
  await createSession(u.id);
  redirect(u.role === "admin" ? "/admin" : "/account");
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!email || !password || !fullName) return { error: "Tüm zorunlu alanları doldurun." };
  if (password.length < 6) return { error: "Şifre en az 6 karakter olmalı." };
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing) return { error: "Bu e-posta zaten kayıtlı." };
  const [u] = await db
    .insert(users)
    .values({ email, passwordHash: hashPassword(password), fullName, phone, role: "guest" })
    .returning();
  await db.insert(notifications).values({
    userId: u.id,
    title: "Orbi City'e hoş geldiniz! 🎉",
    message: "Hesabınız oluşturuldu. İlk rezervasyonunuzda Genius avantajlarını keşfedin.",
    type: "success",
  });
  await createSession(u.id);
  redirect("/account");
}

export async function createReservationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const apartmentId = Number(formData.get("apartmentId"));
  const checkIn = String(formData.get("checkIn") || "");
  const checkOut = String(formData.get("checkOut") || "");
  const guests = Number(formData.get("guests") || 1);
  const couponCode = String(formData.get("couponCode") || "").trim() || null;
  const guestName = String(formData.get("guestName") || "").trim();
  const guestEmail = String(formData.get("guestEmail") || "").trim();
  const guestPhone = String(formData.get("guestPhone") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!apartmentId || !checkIn || !checkOut) return { error: "Lütfen tarih seçin." };
  if (!guestName || !guestEmail) return { error: "İsim ve e-posta gerekli." };
  if (checkOut <= checkIn) return { error: "Çıkış tarihi giriş tarihinden sonra olmalı." };

  const free = await isAvailable(apartmentId, checkIn, checkOut);
  if (!free) return { error: "Seçtiğiniz tarihler dolu. Lütfen başka tarih deneyin." };

  const user = await getCurrentUser();
  const quote = await buildQuote({
    apartmentId,
    checkIn,
    checkOut,
    geniusLevel: user?.geniusLevel ?? 0,
    couponCode,
  });
  if (!quote.ok) return { error: quote.error || "Fiyat hesaplanamadı." };

  const reference = generateReference();
  await db.insert(reservations).values({
    reference,
    apartmentId,
    userId: user?.id ?? null,
    checkIn,
    checkOut,
    nights: quote.nights,
    guests,
    basePrice: String(quote.basePrice),
    subtotal: String(quote.subtotal),
    geniusDiscount: String(quote.geniusDiscount),
    couponDiscount: String(quote.couponDiscount),
    totalPrice: String(quote.total),
    couponId: quote.couponId,
    guestName,
    guestEmail,
    guestPhone,
    note,
    status: "confirmed",
    paymentStatus: "paid",
  });

  if (quote.couponId) {
    await db
      .update(coupons)
      .set({ usedCount: sql`used_count + 1` })
      .where(eq(coupons.id, quote.couponId));
  }

  // Genius recalculation (app-level trigger)
  if (user) {
    const total = (
      await db
        .select({ c: count() })
        .from(reservations)
        .where(and(eq(reservations.userId, user.id), sql`status <> 'cancelled'`))
    )[0].c;
    const newLevel = levelFromReservations(Number(total));
    const prevLevel = user.geniusLevel;
    await db
      .update(users)
      .set({ totalReservations: Number(total), geniusLevel: newLevel })
      .where(eq(users.id, user.id));
    if (newLevel > prevLevel) {
      const tier = tierFor(newLevel);
      await db.insert(notifications).values({
        userId: user.id,
        title: `Tebrikler! ${tier.name} oldunuz 🏆`,
        message: `Artık %${tier.discountPercent} indirim ve şu avantajlar sizin: ${tier.perks.join(", ")}.`,
        type: "genius",
      });
    }
    await db.insert(notifications).values({
      userId: user.id,
      title: "Rezervasyon onaylandı ✅",
      message: `${reference} numaralı rezervasyonunuz onaylandı.`,
      type: "success",
    });
  }

  revalidatePath("/account");
  redirect(`/reservation/${reference}`);
}

export async function createReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Yorum yapmak için giriş yapın." };
  const apartmentId = Number(formData.get("apartmentId"));
  const rating = Number(formData.get("rating") || 5);
  const comment = String(formData.get("comment") || "").trim();
  if (!apartmentId || !comment) return { error: "Lütfen yorumunuzu yazın." };

  await db.insert(reviews).values({
    apartmentId,
    userId: user.id,
    authorName: user.fullName || "Misafir",
    rating,
    cleanliness: rating,
    location: rating,
    value: rating,
    comment,
  });

  // recompute apartment rating
  const agg = (
    await db
      .select({ a: avg(reviews.rating), c: count() })
      .from(reviews)
      .where(eq(reviews.apartmentId, apartmentId))
  )[0];
  await db
    .update(apartments)
    .set({ rating: String(Number(agg.a ?? 0).toFixed(2)), reviewCount: Number(agg.c) })
    .where(eq(apartments.id, apartmentId));

  revalidatePath(`/apartment/${apartmentId}`);
  return { ok: true };
}


