// =====================================================================
// ORBI CITY BATUMI — Supabase Postgres connection (Vercel serverless)
// DATABASE_URL: Supabase "Connection Pooling" (Transaction mode, port 6543)
// connection string'i olmalı, böylece serverless fonksiyonlarda
// bağlantı tükenmesi (too many clients) yaşanmaz.
// Supabase Dashboard → Project Settings → Database → Connection string
// → "Transaction" sekmesindeki URI'yi kullanın.
// =====================================================================
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Supabase Dashboard → Settings → Database → Connection string (Transaction pooler, port 6543) değerini kullanın.",
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __orbiPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__orbiPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    // Supabase pooler (pgbouncer) prepared statement desteklemediğinden
    // node-postgres'in varsayılan davranışıyla uyumlu çalışır (Drizzle
    // node-postgres adapter prepared statement kullanmaz).
    ssl: { rejectUnauthorized: false },
    max: 1, // serverless: her invocation kendi bağlantısını açar/kapatır
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__orbiPostgresqlPool = pool;
}

export const db = drizzle(pool);

