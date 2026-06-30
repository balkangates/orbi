// =====================================================================
// ORBI CITY BATUMI — Supabase JS Client
// Veritabanı işlemleri Drizzle ORM (src/db) üzerinden yapılır.
// Bu client SADECE şu amaçlar için kullanılır:
//   - Storage (apartman görseli / video / 360 tur yükleme)
//   - Realtime (admin panel canlı rezervasyon bildirimleri)
// =====================================================================
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil. Storage/Realtime özellikleri devre dışı kalır.",
  );
}

/** Tarayıcıda kullanılabilir (anon key, RLS'e tabi) */
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

/** Yalnızca sunucu tarafında kullanılır (service role, RLS bypass) — Storage yazma için */
export function supabaseAdmin() {
  if (!supabaseServiceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Supabase Dashboard → Settings → API → service_role key.",
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export const APARTMENT_MEDIA_BUCKET = "apartment-media";

/** Storage'a dosya yükler, public URL döner. (Admin panel için) */
export async function uploadApartmentMedia(
  file: File,
  apartmentCode: string,
): Promise<{ url: string; error?: string }> {
  try {
    const admin = supabaseAdmin();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${apartmentCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await admin.storage.from(APARTMENT_MEDIA_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) return { url: "", error: error.message };
    const { data } = admin.storage.from(APARTMENT_MEDIA_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (e) {
    return { url: "", error: e instanceof Error ? e.message : "Yükleme hatası" };
  }
}
