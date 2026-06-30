import { db } from "@/db";
import {
  apartments,
  blocks,
  apartmentTypes,
  apartmentImages,
  apartmentAmenities,
  amenities,
  facilities,
  reviews,
  reservations,
} from "@/db/schema";
import { and, eq, gte, lte, desc, asc, sql, inArray, ne } from "drizzle-orm";

export type ApartmentListItem = {
  id: number;
  code: string;
  name: string;
  blockCode: string;
  typeCode: string;
  typeName: string;
  floor: number;
  basePrice: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  seaView: boolean;
  coverImage: string;
  rating: number;
  reviewCount: number;
};

export type SearchFilters = {
  q?: string;
  block?: string;
  type?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  seaView?: boolean;
  sort?: string;
  checkIn?: string;
  checkOut?: string;
};

export async function getFacets() {
  const [blockRows, typeRows] = await Promise.all([
    db.select().from(blocks).orderBy(asc(blocks.code)),
    db.select().from(apartmentTypes).orderBy(asc(apartmentTypes.id)),
  ]);
  return { blocks: blockRows, types: typeRows };
}

export async function searchApartments(f: SearchFilters): Promise<ApartmentListItem[]> {
  const conds = [eq(apartments.status, "active")];
  if (f.block) conds.push(eq(blocks.code, f.block));
  if (f.type) conds.push(eq(apartmentTypes.code, f.type));
  if (f.guests) conds.push(gte(apartments.maxGuests, f.guests));
  if (f.minPrice) conds.push(gte(apartments.basePrice, String(f.minPrice)));
  if (f.maxPrice) conds.push(lte(apartments.basePrice, String(f.maxPrice)));
  if (f.seaView) conds.push(eq(apartments.seaView, true));
  if (f.q) conds.push(sql`(${apartments.name} ILIKE ${"%" + f.q + "%"} OR ${apartments.code} ILIKE ${"%" + f.q + "%"})`);

  let orderBy;
  switch (f.sort) {
    case "price_asc":
      orderBy = asc(apartments.basePrice);
      break;
    case "price_desc":
      orderBy = desc(apartments.basePrice);
      break;
    case "rating":
      orderBy = desc(apartments.rating);
      break;
    default:
      orderBy = asc(apartments.code);
  }

  const rows = await db
    .select({
      id: apartments.id,
      code: apartments.code,
      name: apartments.name,
      blockCode: blocks.code,
      typeCode: apartmentTypes.code,
      typeName: apartmentTypes.name,
      floor: apartments.floor,
      basePrice: apartments.basePrice,
      maxGuests: apartments.maxGuests,
      bedrooms: apartments.bedrooms,
      bathrooms: apartments.bathrooms,
      sizeSqm: apartments.sizeSqm,
      seaView: apartments.seaView,
      coverImage: apartments.coverImage,
      rating: apartments.rating,
      reviewCount: apartments.reviewCount,
    })
    .from(apartments)
    .innerJoin(blocks, eq(apartments.blockId, blocks.id))
    .innerJoin(apartmentTypes, eq(apartments.typeId, apartmentTypes.id))
    .where(and(...conds))
    .orderBy(orderBy)
    .limit(300);

  let list = rows.map((r) => ({ ...r, basePrice: parseFloat(r.basePrice), rating: parseFloat(r.rating) }));

  // Availability filter if dates provided
  if (f.checkIn && f.checkOut && f.checkOut > f.checkIn) {
    const booked = await db
      .select({ apartmentId: reservations.apartmentId })
      .from(reservations)
      .where(
        and(
          ne(reservations.status, "cancelled"),
          sql`${reservations.checkIn} < ${f.checkOut}`,
          sql`${reservations.checkOut} > ${f.checkIn}`,
        ),
      );
    const bookedSet = new Set(booked.map((b) => b.apartmentId));
    list = list.filter((a) => !bookedSet.has(a.id));
  }

  return list;
}

export async function getFeatured(limit = 6): Promise<ApartmentListItem[]> {
  const rows = await searchApartments({ seaView: true, sort: "rating" });
  return rows.slice(0, limit);
}

export async function getApartmentDetail(id: number) {
  const rows = await db
    .select({
      id: apartments.id,
      code: apartments.code,
      name: apartments.name,
      blockId: apartments.blockId,
      blockCode: blocks.code,
      typeCode: apartmentTypes.code,
      typeName: apartmentTypes.name,
      floor: apartments.floor,
      description: apartments.description,
      rules: apartments.rules,
      basePrice: apartments.basePrice,
      maxGuests: apartments.maxGuests,
      bedrooms: apartments.bedrooms,
      bathrooms: apartments.bathrooms,
      sizeSqm: apartments.sizeSqm,
      seaView: apartments.seaView,
      coverImage: apartments.coverImage,
      videoUrl: apartments.videoUrl,
      tour360Url: apartments.tour360Url,
      rating: apartments.rating,
      reviewCount: apartments.reviewCount,
    })
    .from(apartments)
    .innerJoin(blocks, eq(apartments.blockId, blocks.id))
    .innerJoin(apartmentTypes, eq(apartments.typeId, apartmentTypes.id))
    .where(eq(apartments.id, id))
    .limit(1);
  const apt = rows[0];
  if (!apt) return null;

  const [imgs, amenityRows, reviewRows, bookedRows] = await Promise.all([
    db.select().from(apartmentImages).where(eq(apartmentImages.apartmentId, id)).orderBy(asc(apartmentImages.sortOrder)),
    db
      .select({ name: amenities.name, icon: amenities.icon })
      .from(apartmentAmenities)
      .innerJoin(amenities, eq(apartmentAmenities.amenityId, amenities.id))
      .where(eq(apartmentAmenities.apartmentId, id)),
    db.select().from(reviews).where(eq(reviews.apartmentId, id)).orderBy(desc(reviews.createdAt)).limit(20),
    db
      .select({ checkIn: reservations.checkIn, checkOut: reservations.checkOut })
      .from(reservations)
      .where(and(eq(reservations.apartmentId, id), ne(reservations.status, "cancelled"), gte(reservations.checkOut, sql`CURRENT_DATE`))),
  ]);

  return {
    ...apt,
    basePrice: parseFloat(apt.basePrice),
    rating: parseFloat(apt.rating),
    images: imgs.map((i) => i.url),
    amenities: amenityRows,
    reviews: reviewRows,
    bookedRanges: bookedRows,
  };
}

export async function getSimilar(typeCode: string, excludeId: number, limit = 4) {
  const all = await searchApartments({ type: typeCode });
  return all.filter((a) => a.id !== excludeId).slice(0, limit);
}

export async function getActiveFacilities() {
  return db.select().from(facilities).where(eq(facilities.active, true)).orderBy(asc(facilities.sortOrder));
}

export { inArray };
