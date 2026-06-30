import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { reservations, apartments, blocks, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { tierFor, GENIUS_TIERS } from "@/lib/genius";
import { money, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [resv, notifs] = await Promise.all([
    db
      .select({
        r: reservations,
        aptName: apartments.name,
        aptId: apartments.id,
        cover: apartments.coverImage,
        blockCode: blocks.code,
      })
      .from(reservations)
      .innerJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .innerJoin(blocks, eq(apartments.blockId, blocks.id))
      .where(eq(reservations.userId, user.id))
      .orderBy(desc(reservations.createdAt)),
    db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(10),
  ]);

  const tier = tierFor(user.geniusLevel);
  const nextTier = GENIUS_TIERS.find((t) => t.level === user.geniusLevel + 1);
  const progress = nextTier
    ? Math.min(100, Math.round((user.totalReservations / nextTier.minReservations) * 100))
    : 100;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-800">Merhaba, {user.fullName.split(" ")[0]} 👋</h1>
      <p className="text-sm text-slate-500">Hesabınızı ve rezervasyonlarınızı buradan yönetin.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Reservations */}
        <div>
          <h2 className="mb-3 text-lg font-extrabold text-slate-800">Rezervasyonlarım ({resv.length})</h2>
          {resv.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              Henüz rezervasyonunuz yok.{" "}
              <Link href="/search" className="font-semibold text-[#0071c2] hover:underline">
                Daireleri keşfedin →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {resv.map((row) => (
                <div key={row.r.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.cover} alt={row.aptName} className="h-24 w-32 rounded-lg object-cover" />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between">
                      <Link href={`/apartment/${row.aptId}`} className="font-bold text-slate-800 hover:text-[#0071c2]">
                        {row.aptName}
                      </Link>
                      <StatusBadge status={row.r.status} />
                    </div>
                    <div className="text-xs text-slate-500">Blok {row.blockCode} · {row.r.reference}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {formatDate(row.r.checkIn)} → {formatDate(row.r.checkOut)} · {row.r.nights} gece
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-lg font-extrabold text-slate-900">{money(row.r.totalPrice)}</span>
                      <Link href={`/reservation/${row.r.reference}`} className="text-sm font-semibold text-[#0071c2] hover:underline">
                        Detaylar →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Genius */}
          <div className="rounded-xl bg-gradient-to-br from-[#003580] to-[#0071c2] p-5 text-white">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-xs font-extrabold text-[#003580]">Genius</span>
              <span className="font-bold">{tier.name}</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold">%{tier.discountPercent} indirim</div>
            <div className="mt-1 text-sm text-white/80">{user.totalReservations} tamamlanmış rezervasyon</div>
            {nextTier ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-white/80">
                  <span>Seviye {nextTier.level} için</span>
                  <span>
                    {user.totalReservations}/{nextTier.minReservations}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-amber-400" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-amber-300">🏆 En yüksek seviyedesiniz!</div>
            )}
            <ul className="mt-4 space-y-1 text-sm text-white/90">
              {tier.perks.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
          </div>

          {/* Notifications */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 font-bold text-slate-800">🔔 Bildirimler</h3>
            {notifs.length === 0 ? (
              <p className="text-sm text-slate-500">Bildirim yok.</p>
            ) : (
              <div className="space-y-3">
                {notifs.map((n) => (
                  <div key={n.id} className="border-l-2 border-[#0071c2] pl-3">
                    <div className="text-sm font-semibold text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500">{n.message}</div>
                    <div className="text-[11px] text-slate-400">{formatDate(n.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700",
    completed: "bg-slate-100 text-slate-600",
  };
  const label: Record<string, string> = {
    confirmed: "Onaylandı",
    pending: "Beklemede",
    cancelled: "İptal",
    completed: "Tamamlandı",
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${map[status] || map.completed}`}>{label[status] || status}</span>;
}
