import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import {
  apartments,
  reservations,
  users,
  coupons,
  facilities,
  pricingRules,
  blocks,
} from "@/db/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { money, formatDate } from "@/lib/format";
import {
  toggleApartmentStatus,
  updateApartmentPrice,
  toggleFacility,
  addCoupon,
  toggleCoupon,
  addPricingRule,
  setReservationStatus,
} from "@/lib/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const [aptCount, activeCount, resvCount, userCount, revenueRow] = await Promise.all([
    db.select({ c: count() }).from(apartments),
    db.select({ c: count() }).from(apartments).where(eq(apartments.status, "active")),
    db.select({ c: count() }).from(reservations),
    db.select({ c: count() }).from(users),
    db.select({ s: sql<string>`COALESCE(SUM(total_price),0)` }).from(reservations).where(sql`status <> 'cancelled'`),
  ]);

  const [recentResv, couponRows, facilityRows, ruleRows, aptRows] = await Promise.all([
    db
      .select({
        r: reservations,
        aptName: apartments.name,
      })
      .from(reservations)
      .innerJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .orderBy(desc(reservations.createdAt))
      .limit(12),
    db.select().from(coupons).orderBy(desc(coupons.id)),
    db.select().from(facilities).orderBy(facilities.sortOrder),
    db.select().from(pricingRules).orderBy(desc(pricingRules.id)),
    db
      .select({
        id: apartments.id,
        code: apartments.code,
        name: apartments.name,
        blockCode: blocks.code,
        basePrice: apartments.basePrice,
        status: apartments.status,
      })
      .from(apartments)
      .innerJoin(blocks, eq(apartments.blockId, blocks.id))
      .orderBy(apartments.code)
      .limit(60),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Admin Panel</h1>
          <p className="text-sm text-slate-500">Orbi City Batumi yönetim merkezi</p>
        </div>
        <Link href="/" className="text-sm font-semibold text-[#0071c2] hover:underline">
          ← Siteye dön
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Toplam Daire" value={String(aptCount[0].c)} icon="🏢" />
        <Kpi label="Aktif Daire" value={String(activeCount[0].c)} icon="✅" />
        <Kpi label="Rezervasyon" value={String(resvCount[0].c)} icon="📅" />
        <Kpi label="Kullanıcı" value={String(userCount[0].c)} icon="👥" />
        <Kpi label="Toplam Ciro" value={money(revenueRow[0].s)} icon="💰" />
      </div>

      {/* Recent reservations */}
      <Card title="Son Rezervasyonlar">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">Ref</th>
                <th className="px-2 py-2">Daire</th>
                <th className="px-2 py-2">Misafir</th>
                <th className="px-2 py-2">Tarih</th>
                <th className="px-2 py-2">Tutar</th>
                <th className="px-2 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {recentResv.map((row) => (
                <tr key={row.r.id} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-mono text-xs">{row.r.reference}</td>
                  <td className="px-2 py-2">{row.aptName}</td>
                  <td className="px-2 py-2">{row.r.guestName}</td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {formatDate(row.r.checkIn)} → {formatDate(row.r.checkOut)}
                  </td>
                  <td className="px-2 py-2 font-semibold">{money(row.r.totalPrice)}</td>
                  <td className="px-2 py-2">
                    <form action={setReservationStatus} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={row.r.id} />
                      <select name="status" defaultValue={row.r.status} className="rounded border border-slate-300 px-1 py-0.5 text-xs">
                        <option value="confirmed">Onaylı</option>
                        <option value="pending">Beklemede</option>
                        <option value="completed">Tamamlandı</option>
                        <option value="cancelled">İptal</option>
                      </select>
                      <button className="rounded bg-slate-700 px-2 py-0.5 text-xs text-white">Kaydet</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coupons */}
        <Card title="Kuponlar">
          <form action={addCoupon} className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <input name="code" placeholder="KOD" required className="rounded border border-slate-300 px-2 py-1 uppercase" />
            <select name="discountType" className="rounded border border-slate-300 px-2 py-1">
              <option value="percent">Yüzde %</option>
              <option value="fixed">Sabit $</option>
            </select>
            <input name="discountValue" type="number" placeholder="Değer" defaultValue={10} className="rounded border border-slate-300 px-2 py-1" />
            <input name="minNights" type="number" placeholder="Min gece" defaultValue={1} className="rounded border border-slate-300 px-2 py-1" />
            <button className="col-span-2 rounded bg-[#0071c2] py-1.5 font-semibold text-white">Kupon Ekle</button>
          </form>
          <div className="space-y-1 text-sm">
            {couponRows.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
                <span>
                  <span className="font-mono font-bold">{c.code}</span>{" "}
                  <span className="text-slate-500">
                    {c.discountType === "percent" ? `%${c.discountValue}` : money(c.discountValue)} · min {c.minNights} gece · {c.usedCount}/{c.maxUses}
                  </span>
                </span>
                <form action={toggleCoupon}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className={`rounded px-2 py-0.5 text-xs font-semibold ${c.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                    {c.active ? "Aktif" : "Pasif"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing rules */}
        <Card title="Dinamik Fiyat Kuralları">
          <form action={addPricingRule} className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
            <input name="name" placeholder="Kural adı" required className="rounded border border-slate-300 px-2 py-1" />
            <select name="ruleType" className="rounded border border-slate-300 px-2 py-1">
              <option value="season">Sezon</option>
              <option value="weekend">Hafta Sonu</option>
              <option value="lastminute">Son Dakika</option>
            </select>
            <input name="startDate" type="date" className="rounded border border-slate-300 px-2 py-1" />
            <input name="endDate" type="date" className="rounded border border-slate-300 px-2 py-1" />
            <input name="multiplier" type="number" step="0.05" placeholder="Çarpan (1.4)" defaultValue="1.4" className="rounded border border-slate-300 px-2 py-1" />
            <input name="priority" type="number" placeholder="Öncelik" defaultValue={5} className="rounded border border-slate-300 px-2 py-1" />
            <button className="col-span-2 rounded bg-[#0071c2] py-1.5 font-semibold text-white">Kural Ekle</button>
          </form>
          <div className="space-y-1 text-sm">
            {ruleRows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5">
                <span>
                  <span className="font-semibold">{r.name}</span>{" "}
                  <span className="text-slate-500">
                    ×{r.multiplier} · {r.ruleType}
                    {r.startDate ? ` · ${r.startDate}→${r.endDate}` : ""}
                  </span>
                </span>
                <span className={`text-xs ${r.active ? "text-green-600" : "text-slate-400"}`}>{r.active ? "açık" : "kapalı"}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Facilities */}
      <Card title="Tesis Olanakları">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {facilityRows.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm">
              <span>
                {f.icon} <span className="font-semibold">{f.name}</span>
              </span>
              <form action={toggleFacility}>
                <input type="hidden" name="id" value={f.id} />
                <button className={`rounded px-2 py-0.5 text-xs font-semibold ${f.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                  {f.active ? "Aktif" : "Pasif"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </Card>

      {/* Apartments management */}
      <Card title="Daire Yönetimi (ilk 60)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">Kod</th>
                <th className="px-2 py-2">Daire</th>
                <th className="px-2 py-2">Fiyat</th>
                <th className="px-2 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {aptRows.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-2 py-2 font-mono text-xs">{a.code}</td>
                  <td className="px-2 py-2">
                    <Link href={`/apartment/${a.id}`} className="hover:text-[#0071c2]">{a.name}</Link>
                  </td>
                  <td className="px-2 py-2">
                    <form action={updateApartmentPrice} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <input name="price" defaultValue={a.basePrice} className="w-20 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                      <button className="rounded bg-slate-700 px-2 py-0.5 text-xs text-white">$</button>
                    </form>
                  </td>
                  <td className="px-2 py-2">
                    <form action={toggleApartmentStatus}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className={`rounded px-2 py-0.5 text-xs font-semibold ${a.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                        {a.status === "active" ? "Aktif" : "Pasif"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-extrabold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}
