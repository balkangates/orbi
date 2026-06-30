// =====================================================================
// ORBI CITY BATUMI — Single Property Booking Engine
// Drizzle ORM schema (PostgreSQL)
// NOTE: Table & column names are a PERMANENT reference. Do not rename.
// =====================================================================
import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  date,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------
// USERS  (Auth + Genius loyalty)
// ---------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    role: text("role").notNull().default("guest"), // guest | admin
    geniusLevel: integer("genius_level").notNull().default(0),
    totalReservations: integer("total_reservations").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

// ---------------------------------------------------------------------
// SESSIONS  (cookie auth)
// ---------------------------------------------------------------------
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random token
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------
// BLOCKS  (A, B, C)
// ---------------------------------------------------------------------
export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(), // A | B | C
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    floors: integer("floors").notNull().default(40),
  },
  (t) => ({
    codeIdx: uniqueIndex("blocks_code_idx").on(t.code),
  }),
);

// ---------------------------------------------------------------------
// APARTMENT TYPES
// ---------------------------------------------------------------------
export const apartmentTypes = pgTable(
  "apartment_types",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(), // studio | 1+1 | 2+1 | 3+1 | penthouse | loft | duplex
    name: text("name").notNull(),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: integer("bathrooms").notNull().default(1),
    maxGuests: integer("max_guests").notNull().default(2),
    sizeSqm: integer("size_sqm").notNull().default(35),
  },
  (t) => ({
    codeIdx: uniqueIndex("apartment_types_code_idx").on(t.code),
  }),
);

// ---------------------------------------------------------------------
// AMENITIES  (per-apartment)
// ---------------------------------------------------------------------
export const amenities = pgTable("amenities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("✨"),
  category: text("category").notNull().default("general"),
});

// ---------------------------------------------------------------------
// FACILITIES  (shared, admin-managed)
// ---------------------------------------------------------------------
export const facilities = pgTable("facilities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("🏨"),
  hours: text("hours").notNull().default("24/7"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------------------------------------------------------------------
// APARTMENTS
// ---------------------------------------------------------------------
export const apartments = pgTable(
  "apartments",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(), // e.g. A-1203
    name: text("name").notNull(),
    blockId: integer("block_id")
      .notNull()
      .references(() => blocks.id),
    typeId: integer("type_id")
      .notNull()
      .references(() => apartmentTypes.id),
    floor: integer("floor").notNull().default(1),
    description: text("description").notNull().default(""),
    rules: text("rules").notNull().default(""),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("80"),
    maxGuests: integer("max_guests").notNull().default(2),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: integer("bathrooms").notNull().default(1),
    sizeSqm: integer("size_sqm").notNull().default(35),
    seaView: boolean("sea_view").notNull().default(false),
    coverImage: text("cover_image").notNull().default(""),
    videoUrl: text("video_url").notNull().default(""),
    tour360Url: text("tour_360_url").notNull().default(""),
    rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    status: text("status").notNull().default("active"), // active | inactive
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex("apartments_code_idx").on(t.code),
    blockIdx: index("apartments_block_idx").on(t.blockId),
    typeIdx: index("apartments_type_idx").on(t.typeId),
  }),
);

// ---------------------------------------------------------------------
// APARTMENT IMAGES
// ---------------------------------------------------------------------
export const apartmentImages = pgTable(
  "apartment_images",
  {
    id: serial("id").primaryKey(),
    apartmentId: integer("apartment_id")
      .notNull()
      .references(() => apartments.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    apartmentIdx: index("apartment_images_apartment_idx").on(t.apartmentId),
  }),
);

// ---------------------------------------------------------------------
// APARTMENT <-> AMENITIES  (join)
// ---------------------------------------------------------------------
export const apartmentAmenities = pgTable(
  "apartment_amenities",
  {
    apartmentId: integer("apartment_id")
      .notNull()
      .references(() => apartments.id, { onDelete: "cascade" }),
    amenityId: integer("amenity_id")
      .notNull()
      .references(() => amenities.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.apartmentId, t.amenityId] }),
  }),
);

// ---------------------------------------------------------------------
// PRICING RULES  (Dynamic pricing)
// ---------------------------------------------------------------------
export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: serial("id").primaryKey(),
    apartmentId: integer("apartment_id").references(() => apartments.id, {
      onDelete: "cascade",
    }), // null = global rule
    name: text("name").notNull(),
    ruleType: text("rule_type").notNull().default("season"), // season | weekend | lastminute | length
    startDate: date("start_date"),
    endDate: date("end_date"),
    multiplier: numeric("multiplier", { precision: 5, scale: 2 }).notNull().default("1.0"),
    priority: integer("priority").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    apartmentIdx: index("pricing_rules_apartment_idx").on(t.apartmentId),
  }),
);

// ---------------------------------------------------------------------
// COUPONS
// ---------------------------------------------------------------------
export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    discountType: text("discount_type").notNull().default("percent"), // percent | fixed
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull().default("10"),
    minNights: integer("min_nights").notNull().default(1),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    maxUses: integer("max_uses").notNull().default(1000),
    usedCount: integer("used_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    codeIdx: uniqueIndex("coupons_code_idx").on(t.code),
  }),
);

// ---------------------------------------------------------------------
// RESERVATIONS
// ---------------------------------------------------------------------
export const reservations = pgTable(
  "reservations",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull(),
    apartmentId: integer("apartment_id")
      .notNull()
      .references(() => apartments.id),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    nights: integer("nights").notNull().default(1),
    guests: integer("guests").notNull().default(1),
    basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
    geniusDiscount: numeric("genius_discount", { precision: 10, scale: 2 }).notNull().default("0"),
    couponDiscount: numeric("coupon_discount", { precision: 10, scale: 2 }).notNull().default("0"),
    totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
    couponId: integer("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    guestName: text("guest_name").notNull().default(""),
    guestEmail: text("guest_email").notNull().default(""),
    guestPhone: text("guest_phone").notNull().default(""),
    note: text("note").notNull().default(""),
    status: text("status").notNull().default("confirmed"), // pending | confirmed | cancelled | completed
    paymentStatus: text("payment_status").notNull().default("paid"), // paid | unpaid | refunded
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    refIdx: uniqueIndex("reservations_reference_idx").on(t.reference),
    apartmentIdx: index("reservations_apartment_idx").on(t.apartmentId),
    userIdx: index("reservations_user_idx").on(t.userId),
    dateIdx: index("reservations_date_idx").on(t.checkIn, t.checkOut),
  }),
);

// ---------------------------------------------------------------------
// REVIEWS
// ---------------------------------------------------------------------
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    apartmentId: integer("apartment_id")
      .notNull()
      .references(() => apartments.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    reservationId: integer("reservation_id").references(() => reservations.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull().default("Guest"),
    rating: integer("rating").notNull().default(5),
    cleanliness: integer("cleanliness").notNull().default(5),
    location: integer("location").notNull().default(5),
    value: integer("value").notNull().default(5),
    comment: text("comment").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    apartmentIdx: index("reviews_apartment_idx").on(t.apartmentId),
  }),
);

// ---------------------------------------------------------------------
// NOTIFICATIONS
// ---------------------------------------------------------------------
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    type: text("type").notNull().default("info"), // info | success | warning | genius
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------
// GENIUS LEVELS  (loyalty configuration)
// ---------------------------------------------------------------------
export const geniusLevels = pgTable("genius_levels", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull(),
  name: text("name").notNull(),
  minReservations: integer("min_reservations").notNull().default(0),
  discountPercent: integer("discount_percent").notNull().default(0),
  perks: text("perks").notNull().default(""),
});

// Convenience type exports
export type Apartment = typeof apartments.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Facility = typeof facilities.$inferSelect;
