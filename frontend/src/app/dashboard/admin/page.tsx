"use client";

import { useEffect, useMemo, useState } from "react";
import { myAppHook } from "../../../../context/AppProvider";
import { BASE } from "@/app/lib/api";
import {
    getAdminOverview, getRevenueSeries, getCompanyBreakdown, getTopRoutes,
} from "../../../lib/adminApi";
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend, BarChart, Bar,
} from "recharts";

/* ---------- Tipler ---------- */
type Totals = {
    orders: number; revenue: number; active_trips: number; upcoming: number; personnel: number; customers: number;
};
type SeriesItem = { d: string; revenue: number };
type BreakdownItem = { name: string; revenue: number; orders: number };
type RouteItem = { terminal_from: string; terminal_to: string; seats: number; revenue: number };
type ApiErr = { message?: string; errors?: Record<string, string[] | string> };

export default function AdminOverviewPage() {
    const { token, isLoading, user } = myAppHook() as any;

    const [totals, setTotals] = useState<Totals | null>(null);
    const [series, setSeries] = useState<SeriesItem[]>([]);
    const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
    const [routes, setRoutes] = useState<RouteItem[]>([]);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string>("");
    const [banner, setBanner] = useState<string>("");

    /* ================= CSV: Sunucu → İstemci fallback =================
       - Önce /company/export/array'a POST dener.
       - Hata olursa istemcide CSV metnini üretip indirir.
       - Ayırıcı ;, UTF-8 BOM: Excel/TR uyumlu
    =================================================================== */
    const csvEscape = (v: any) => {
        const s = String(v ?? "");
        return /[\";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const buildCsv = (headings: string[], rows: (string | number)[][]) => {
        const bom = "\uFEFF";
        const head = headings.length ? headings.map(csvEscape).join(";") + "\n" : "";
        const body = rows.map(r => r.map(csvEscape).join(";")).join("\n");
        return bom + head + body + (body ? "\n" : "");
    };
    const downloadText = (filename: string, text: string) => {
        const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    };
    const saveCsv = async (filename: string, headings: string[], rows: (string | number)[][]) => {
        try {
            const res = await fetch(`${BASE}/company/export/array`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ filename, headings, rows }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch {
            downloadText(filename, buildCsv(headings, rows));
        }
    };

    /* ---------- CSV export butonları (üst) ---------- */
    const exportTotals = () => saveCsv(
        "genel_ozet.csv",
        ["Sipariş", "Gelir", "Aktif Sefer", "Yaklaşan", "Personel", "Müşteri"],
        [[totals?.orders ?? 0, totals?.revenue ?? 0, totals?.active_trips ?? 0, totals?.upcoming ?? 0, totals?.personnel ?? 0, totals?.customers ?? 0]],
    );
    const exportSeries = () => saveCsv(
        "gelir_serisi_30g.csv",
        ["#", "Tarih", "Gelir"],
        series.map((x, i) => [i + 1, x.d, x.revenue]),
    );
    const exportBreakdown = () => saveCsv(
        "sirket_kirilimi.csv",
        ["#", "Ad", "Gelir", "Sipariş"],
        breakdown.map((x, i) => [i + 1, x.name, x.revenue, x.orders]),
    );
    const exportRoutes = () => saveCsv(
        "en_cok_satan_guzergahlar.csv",
        ["#", "Güzergah", "Koltuk", "Gelir"],
        routes.map((r, i) => [i + 1, `${r.terminal_from} → ${r.terminal_to}`, r.seats, r.revenue]),
    );
    // Tablo HER SATIR CSV: yalnızca güzergâh tablosunda satır var
    const exportRouteRow = (idx: number, r: RouteItem) => saveCsv(
        `guzergah_${idx + 1}.csv`,
        ["#", "Güzergah", "Koltuk", "Gelir"],
        [[idx + 1, `${r.terminal_from} → ${r.terminal_to}`, r.seats, r.revenue]],
    );

    /* ---------- Sayısal normalizasyon ---------- */
    const parseNumber = (v: any) => {
        if (typeof v === "number") return v;
        if (v === null || v === undefined || v === "") return 0;
        if (typeof v === "string") {
            const s = v.replace(/\./g, "").replace(",", ".");
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    // TL kuruş/format heuristics
    const normalizeMoney = (v: any) => {
        const n = parseNumber(v);
        if (n === 0) return 0;
        return n >= 1000 && Math.abs(n % 100) === 0 ? n / 100 : n;
    };

    const TRYc = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
    const fmtTL = (n: any) => TRYc.format(Number(n || 0));

    /* ---------- Veri çekme ---------- */
    const refresh = async () => {
        setLoading(true); setErr(""); setBanner("");
        try {
            const [t, s, b, r] = await Promise.all([
                getAdminOverview(), getRevenueSeries(30), getCompanyBreakdown(), getTopRoutes(),
            ]);

            // Totals
            if (t) {
                setTotals({
                    orders: parseNumber((t as any).orders),
                    revenue: normalizeMoney((t as any).revenue),
                    active_trips: parseNumber((t as any).active_trips),
                    upcoming: parseNumber((t as any).upcoming),
                    personnel: parseNumber((t as any).personnel),
                    customers: parseNumber((t as any).customers),
                });
            } else setTotals(null);

            // Series (son 30 gün)
            setSeries(((s || []) as any[]).map(x => ({ d: String(x.d), revenue: normalizeMoney(x.revenue) })));

            // Şirket kırılımı
            setBreakdown(((b || []) as any[]).map(x => ({
                name: String(x.name ?? ""), revenue: normalizeMoney(x.revenue), orders: parseNumber(x.orders),
            })));

            // Güzergâhlar
            setRoutes(((r || []) as any[]).map(x => ({
                terminal_from: String(x.terminal_from ?? ""),
                terminal_to: String(x.terminal_to ?? ""),
                seats: parseNumber(x.seats),
                revenue: normalizeMoney(x.revenue),
            })));

            setBanner("Güncel veriler yüklendi.");
        } catch (e: any) {
            const p: ApiErr | undefined = e?.response?.data;
            setErr(p?.message || "Veriler alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoading || !token || user?.role !== "admin") return;
        void refresh();
    }, [isLoading, token, user]);

    const hasData = useMemo(
        () => (series.length + breakdown.length + routes.length) > 0 || !!totals,
        [series, breakdown, routes, totals]
    );

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (user?.role !== "admin") return <div className="p-6">Yetkisiz.</div>;

    return (
        <div className="space-y-6 text-indigo-900/80">
            {/* Üst bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>
                <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg border disabled:opacity-50" onClick={()=>void refresh()} disabled={loading}>Yenile</button>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportTotals}>Özet CSV</button>
                </div>
            </div>

            {/* Bannerlar */}
            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            {/* KPI kartları */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="font-semibold text-indigo-900">Genel Özet</h2>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Card title="Toplam Sipariş" value={totals?.orders ?? 0} />
                    <Card title="Toplam Gelir" value={fmtTL(totals?.revenue ?? 0)} />
                    <Card title="Aktif Sefer" value={totals?.active_trips ?? 0} />
                    <Card title="Yaklaşan" value={totals?.upcoming ?? 0} />
                    <Card title="Personel" value={totals?.personnel ?? 0} />
                    <Card title="Müşteri" value={totals?.customers ?? 0} />
                </div>
            </div>

            {/* Gelir grafiği (Son 30 gün) + CSV */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">Gelir (Son 30 gün)</h3>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportSeries}>CSV</button>
                </div>
                <div className="h-72 mt-2">
                    {series.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={series}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="d" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="revenue" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChart />
                    )}
                </div>
            </div>

            {/* Şirket kırılımı + CSV */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">Şirket Kırılımı</h3>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportBreakdown}>CSV</button>
                </div>
                <div className="h-72 mt-2">
                    {breakdown.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={breakdown}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="revenue" />
                                <Bar dataKey="orders" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChart />
                    )}
                </div>
            </div>

            {/* Güzergahlar tablosu + CSV */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">En Çok Satılan Güzergahlar</h3>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportRoutes}>Sayfa CSV</button>
                </div>
                <div className="overflow-x-auto mt-2">
                    <table className="min-w-[880px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">ID</th>
                            <th>Güzergah</th>
                            <th>Koltuk</th>
                            <th>Gelir</th>
                            <th className="text-right">CSV</th> {/* HER SATIR İÇİN */}
                        </tr>
                        </thead>
                        <tbody>
                        {routes.length ? routes.map((r, i) => (
                            <tr key={`${r.terminal_from}-${r.terminal_to}-${i}`} className="border-t">
                                <td className="py-2">{i + 1}</td>
                                <td>{r.terminal_from} → {r.terminal_to}</td>
                                <td>{r.seats}</td>
                                <td>{fmtTL(r.revenue)}</td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border" onClick={()=>exportRouteRow(i, r)}>CSV</button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">{loading ? "Yükleniyor…" : "Kayıt yok"}</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!hasData && !loading && !err && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Görüntülenecek veri bulunamadı.
                </div>
            )}
        </div>
    );
}

/* ---- Kart ---- */
function Card({ title, value }: { title: string; value: any }) {
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold mt-1 text-indigo-900">{value}</div>
        </div>
    );
}

/* ---- Boş grafik placeholder ---- */
function EmptyChart() {
    return (
        <div className="h-full w-full grid place-items-center text-indigo-900/50 text-sm">
            Veri yok
        </div>
    );
}
