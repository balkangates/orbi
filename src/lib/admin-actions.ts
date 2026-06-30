"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { apartments, coupons, facilities, reservations, pricingRules } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export async function toggleApartmentStatus(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = Number(formData.get("id"));
  await db
    .update(apartments)
    .set({ status: sql`CASE WHEN status = 'active' THEN 'inactive' ELSE 'active' END` })
    .where(eq(apartments.id, id));
  revalidatePath("/admin");
}

export async function updateApartmentPrice(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = Number(formData.get("id"));
  const price = String(formData.get("price") || "0");
  await db.update(apartments).set({ basePrice: price }).where(eq(apartments.id, id));
  revalidatePath("/admin");
}

export async function toggleFacility(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = Number(formData.get("id"));
  await db
    .update(facilities)
    .set({ active: sql`NOT active` })
    .where(eq(facilities.id, id));
  revalidatePath("/admin");
}

export async function addCoupon(formData: FormData) {
  if (!(await requireAdmin())) return;
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) return;
  await db.insert(coupons).values({
    code,
    discountType: String(formData.get("discountType") || "percent"),
    discountValue: String(formData.get("discountValue") || "10"),
    minNights: Number(formData.get("minNights") || 1),
    maxUses: Number(formData.get("maxUses") || 1000),
  });
  revalidatePath("/admin");
}

export async function toggleCoupon(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = Number(formData.get("id"));
  await db
    .update(coupons)
    .set({ active: sql`NOT active` })
    .where(eq(coupons.id, id));
  revalidatePath("/admin");
}

export async function addPricingRule(formData: FormData) {
  if (!(await requireAdmin())) return;
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await db.insert(pricingRules).values({
    name,
    ruleType: String(formData.get("ruleType") || "season"),
    startDate: (formData.get("startDate") as string) || null,
    endDate: (formData.get("endDate") as string) || null,
    multiplier: String(formData.get("multiplier") || "1.0"),
    priority: Number(formData.get("priority") || 0),
  });
  revalidatePath("/admin");
}

export async function setReservationStatus(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "confirmed");
  await db.update(reservations).set({ status }).where(eq(reservations.id, id));
  revalidatePath("/admin");
}
