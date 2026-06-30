import type { MetadataRoute } from "next";
import { db } from "@/db";
import { apartments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
const BASE = "https://orbicity-batumi.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let aptUrls: MetadataRoute.Sitemap = [];
  try {
    const rows = await db.select({ id: apartments.id }).from(apartments).where(eq(apartments.status, "active"));
    aptUrls = rows.map((r) => ({ url: `${BASE}/apartment/${r.id}`, changeFrequency: "daily", priority: 0.8 }));
  } catch {
    aptUrls = [];
  }
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/search`, changeFrequency: "daily", priority: 0.9 },
    ...aptUrls,
  ];
}
