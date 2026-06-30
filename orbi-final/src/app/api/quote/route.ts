import { buildQuote, isAvailable } from "@/lib/quote";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const apartmentId = Number(body.apartmentId);
    const checkIn = String(body.checkIn || "");
    const checkOut = String(body.checkOut || "");
    if (!apartmentId || !checkIn || !checkOut) {
      return Response.json({ ok: false, error: "Eksik parametre" }, { status: 400 });
    }
    const user = await getCurrentUser();
    const quote = await buildQuote({
      apartmentId,
      checkIn,
      checkOut,
      geniusLevel: user?.geniusLevel ?? 0,
      couponCode: body.couponCode || null,
    });
    const available = quote.ok ? await isAvailable(apartmentId, checkIn, checkOut) : false;
    return Response.json({ ...quote, available });
  } catch {
    return Response.json({ ok: false, error: "Sunucu hatası" }, { status: 500 });
  }
}
