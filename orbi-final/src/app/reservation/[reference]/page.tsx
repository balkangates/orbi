import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { reservations, apartments, blocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { money, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReservationPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const rows = await db
    .select({
      r: reservations,
      aptName: apartments.name,
      aptCode: apartments.code,
      cover: apartments.coverImage,
      blockCode: blocks.code,
    })
    .from(reservations)
    .innerJoin(apartments, eq(reservations.apartmentId, apartments.id))
    .innerJoin(blocks, eq(apartments.blockId, blocks.id))
    .where(eq(reservations.reference, reference))
    .limit(1);
  const data = rows[0];
  if (!data) notFound();
  const r = data.r;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-4xl">
            ✅
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-800">Rezervasyon Onaylandı!</h1>
          <p className="mt-1 text-sm text-slate-500">
            Onay numaranız: <span className="font-bold text-[#003580]">{r.reference}</span>
          </p>
        </div>

        <div className="mt-6 flex gap-4 rounded-xl bg-slate-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.cover} alt={data.aptName} className="h-24 w-32 rounded-lg object-cover" />
          <div>
            <div className="font-bold text-slate-800">{data.aptName}</div>
            <div className="text-sm text-slate-500">Blok {data.blockCode} · {data.aptCode}</div>
            <div className="mt-1 text-sm text-slate-600">
              {formatDate(r.checkIn)} → {formatDate(r.checkOut)} · {r.nights} gece · {r.guests} misafir
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-sm">
          <Row label="Misafir" value={r.guestName} />
          <Row label="E-posta" value={r.guestEmail} />
          {r.guestPhone && <Row label="Telefon" value={r.guestPhone} />}
          <div className="my-2 border-t border-slate-200" />
          <Row label="Ara toplam" value={money(r.subtotal)} />
          {Number(r.geniusDiscount) > 0 && <Row label="Genius indirimi" value={`−${money(r.geniusDiscount)}`} green />}
          {Number(r.couponDiscount) > 0 && <Row label="Kupon indirimi" value={`−${money(r.couponDiscount)}`} green />}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold">
            <span>Toplam Ödenen</span>
            <span>{money(r.totalPrice)}</span>
          </div>
          <div className="text-right text-xs text-green-600">Ödeme durumu: Ödendi ✓</div>
        </div>

        <div className="mt-8 flex gap-3">
          <Link href="/account" className="flex-1 rounded-lg bg-[#003580] px-4 py-2.5 text-center font-semibold text-white hover:bg-[#00224f]">
            Rezervasyonlarım
          </Link>
          <Link href="/search" className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-center font-semibold text-slate-700 hover:bg-slate-50">
            Yeni Arama
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={green ? "font-medium text-green-700" : "font-medium text-slate-800"}>{value}</span>
    </div>
  );
}
