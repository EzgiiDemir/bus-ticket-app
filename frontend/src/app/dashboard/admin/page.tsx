"use client";

import { useEffect, useMemo, useState } from "react";
import { myAppHook } from "../../../../context/AppProvider";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    BarChart,
    Bar,
} from "recharts";
import { fmtTR } from "../../../lib/datetime";
import { exportCSV, exportJSON } from "@/app/lib/export";
import {
    getAdminOverview,
    getRevenueSeries,
    getCompanyBreakdown,
    getTopRoutes,
} from "../../../lib/adminApi";

/* ---- Tipler ---- */
type Totals = {
    orders: number;
    revenue: number;
    active_trips: number;
    upcoming: number;
    personnel: number;
    customers: number;
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

    /* ---- Yardımcılar ---- */
    const parseNumber = (v: any) => {
        if (typeof v === "number") return v;
        if (v === null || v === undefined || v === "") return 0;
        if (typeof v === "string") {
            // "1.234,56" -> "1234.56", or "1234.56"
            const s = v.replace(/\./g, "").replace(",", ".");
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        }
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    /**
     * Normalize money values that may come from backend as:
     *  - number in TL (e.g. 400)
     *  - number in kuruş / cents (e.g. 40000)
     *  - formatted string "40.000,00" or "40000" or "400.00"
     *
     * Heuristics: if parsed number >= 1000 and looks like multiple of 100, divide by 100.
     */
    const normalizeMoney = (v: any) => {
        const n = parseNumber(v);
        if (n === 0) return 0;
        // If value looks like kuruş (e.g. 40000 -> 400.00) and is integer multiple of 100
        if (n >= 1000 && Math.abs(n % 100) === 0) {
            return n / 100;
        }
        return n;
    };

    const TRYc = new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    });
    const fmtTL = (n: any) => TRYc.format(Number(n || 0));

    const refresh = async () => {
        setLoading(true);
        setErr("");
        setBanner("");
        try {
            const [t, s, b, r] = await Promise.all([
                getAdminOverview(),
                getRevenueSeries(30),
                getCompanyBreakdown(),
                getTopRoutes(),
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
            } else {
                setTotals(null);
            }

            // Series
            setSeries(((s || []) as any[]).map((x) => ({ d: String(x.d), revenue: normalizeMoney(x.revenue) })));

            // Breakdown
            setBreakdown(((b || []) as any[]).map((x) => ({
                name: String(x.name ?? ""),
                revenue: normalizeMoney(x.revenue),
                orders: parseNumber(x.orders),
            })));

            // Routes
            setRoutes(((r || []) as any[]).map((x) => ({
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
                    <button
                        className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        onClick={() => void refresh()}
                        disabled={loading}
                        aria-label="Yenile"
                    >
                        Yenile
                    </button>
                </div>
            </div>

            {/* Bannerlar */}
            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            {/* KPI kartları + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="font-semibold text-indigo-900">Genel Özet</h2>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={!totals}
                            onClick={() => {
                                if (!totals) return;
                                exportCSV(
                                    "admin_ozet",
                                    [totals],
                                    [
                                        { key: "orders", title: "Toplam Sipariş" },
                                        { key: "revenue", title: "Toplam Gelir" },
                                        { key: "active_trips", title: "Aktif Sefer" },
                                        { key: "upcoming", title: "Yaklaşan" },
                                        { key: "personnel", title: "Personel" },
                                        { key: "customers", title: "Müşteri" },
                                    ]
                                );
                            }}
                        >
                            CSV
                        </button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={!totals} onClick={() => totals && exportJSON("admin_ozet", totals)}>
                            JSON
                        </button>
                    </div>
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

            {/* Gelir grafiği + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">Gelir (Son 30 gün)</h3>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={!series.length}
                            onClick={() => {
                                exportCSV(
                                    "gelir_son30gun",
                                    series,
                                    [
                                        { key: "d", title: "Tarih" },
                                        { key: "revenue", title: "Gelir" },
                                    ]
                                );
                            }}
                        >
                            CSV
                        </button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={!series.length} onClick={() => exportJSON("gelir_son30gun", series)}>
                            JSON
                        </button>
                    </div>
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

            {/* Şirket kırılımı + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">Şirket Kırılımı</h3>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={!breakdown.length}
                            onClick={() => {
                                exportCSV(
                                    "sirket_kirilimi",
                                    breakdown,
                                    [
                                        { key: "name", title: "Şirket" },
                                        { key: "revenue", title: "Gelir" },
                                        { key: "orders", title: "Sipariş" },
                                    ]
                                );
                            }}
                        >
                            CSV
                        </button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={!breakdown.length} onClick={() => exportJSON("sirket_kirilimi", breakdown)}>
                            JSON
                        </button>
                    </div>
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

            {/* Güzergahlar tablosu + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">En Çok Satılan Güzergahlar</h3>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={!routes.length}
                            onClick={() => {
                                exportCSV(
                                    "en_cok_satan_guzergahlar",
                                    routes,
                                    [
                                        { key: "terminal_from", title: "Kalkış" },
                                        { key: "terminal_to", title: "Varış" },
                                        { key: "seats", title: "Koltuk" },
                                        { key: "revenue", title: "Gelir" },
                                    ]
                                );
                            }}
                        >
                            CSV
                        </button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={!routes.length} onClick={() => exportJSON("en_cok_satan_guzergahlar", routes)}>
                            JSON
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto mt-2">
                    <table className="min-w-[720px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Güzergah</th>
                            <th>Koltuk</th>
                            <th>Gelir</th>
                        </tr>
                        </thead>
                        <tbody>
                        {routes.length ? (
                            routes.map((r, i) => (
                                <tr key={`${r.terminal_from}-${r.terminal_to}-${i}`} className="border-t">
                                    <td className="py-2">{r.terminal_from} → {r.terminal_to}</td>
                                    <td>{r.seats}</td>
                                    <td>{fmtTL(r.revenue)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-6 text-center text-indigo-900/50">{loading ? "Yükleniyor…" : "Kayıt yok"}</td>
                            </tr>
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
