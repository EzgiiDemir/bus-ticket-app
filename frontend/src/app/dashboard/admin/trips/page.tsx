"use client";
import { useEffect, useMemo, useState } from "react";
import { myAppHook } from "../../../../../context/AppProvider";
import { listTrips } from "../../../../lib/adminApi";
import { fmtTR } from "../../../../lib/datetime";
import { exportCSV } from "@/app/lib/export";

type Trip = {
    id: number;
    trip?: string;
    company_name?: string;
    company?: { name?: string };
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    cost: number | string;
    capacity_reservation: number;
    is_active: boolean | number;
    orders?: number | string;
    seats?: number | string;
    revenue?: number | string;
};

export default function AdminTrips() {
    const { token, isLoading, user } = myAppHook() as any;
    const [rows, setRows] = useState<Trip[]>([]);
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [loading, setLoading] = useState(false);

    const toNum = (v: any) =>
        Number(
            (typeof v === "string" ? v.replace(/\./g, "").replace(",", ".") : v) || 0
        );
    const fmtTL = (v: any) =>
        new Intl.NumberFormat("tr-TR", {
            style: "currency",
            currency: "TRY",
            maximumFractionDigits: 2,
        }).format(toNum(v));

    // --- SON SAAT yardımcıları ---
    const toISO = (s?: string) => (s ? (s.includes("T") ? s : s.replace(" ", "T")) : "");
    const minutesLeft = (s?: string) => {
        if (!s) return Number.POSITIVE_INFINITY;
        const ms = new Date(toISO(s)).getTime() - Date.now();
        return Math.floor(ms / 60000);
    };

    useEffect(() => {
        if (isLoading || !token || user?.role !== "admin") return;
        setLoading(true);
        listTrips({ q })
            .then((d: any) =>
                setRows(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : [])
            )
            .finally(() => setLoading(false));
    }, [isLoading, token, user, q]);

    const filtered = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return rows;
        return rows.filter((r) =>
            [
                r.trip,
                r.company_name,
                r.company?.name,
                r.terminal_from,
                r.terminal_to,
                r.departure_time,
            ]
                .some((x) => String(x || "").toLowerCase().includes(t))
        );
    }, [rows, q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    const paged = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, page, pageSize]);

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role !== "admin") return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-indigo-900/70">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (sefer, firma, güzergâh)…"
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={pageSize}
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                        }}
                        aria-label="Sayfa başına"
                    >
                        {[10, 20, 50, 100].map((n) => (
                            <option key={n} value={n}>
                                {n}/sayfa
                            </option>
                        ))}
                    </select>

                    <button
                        className="rounded-xl border px-3 py-2"
                        onClick={() => {
                            exportCSV("seferler_tumu", filtered, [
                                { key: "trip", title: "Sefer" },
                                {
                                    key: "company_name",
                                    title: "Firma",
                                    map: (r: Trip) => r.company_name || r.company?.name || "",
                                },
                                {
                                    key: "route",
                                    title: "Güzergah",
                                    map: (r: Trip) => `${r.terminal_from} → ${r.terminal_to}`,
                                },
                                { key: "departure_time", title: "Kalkış" },
                                {
                                    key: "minutes_left",
                                    title: "Kalan (dk)",
                                    map: (r: Trip) => minutesLeft(r.departure_time),
                                },
                                {
                                    key: "status",
                                    title: "Durum",
                                    map: (r: Trip) => {
                                        const m = minutesLeft(r.departure_time);
                                        return m < 0 ? "Geçti" : m <= 60 ? "Son Saat" : "Normal";
                                    },
                                },
                                { key: "cost", title: "Ücret", map: (r: Trip) => toNum(r.cost) },
                                { key: "capacity_reservation", title: "Kapasite" },
                                {
                                    key: "is_active",
                                    title: "Aktif",
                                    map: (r: Trip) => (r.is_active ? "Evet" : "Hayır"),
                                },
                                { key: "orders", title: "Sipariş", map: (r: Trip) => toNum(r.orders) },
                                { key: "seats", title: "Koltuk", map: (r: Trip) => toNum(r.seats) },
                                { key: "revenue", title: "Gelir", map: (r: Trip) => toNum(r.revenue) },
                            ]);
                        }}
                    >
                        CSV
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen:{" "}
                    <b>{total ? (total === 0 ? 0 : (page - 1) * pageSize + 1) : 0}–{Math.min(page * pageSize, total)}</b>{" "}
                    / {total} • &nbsp;Sayfa {page}/{totalPages}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-[1180px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Sefer</th>
                            <th>Firma</th>
                            <th>Güzergah</th>
                            <th>Kalkış</th>
                            <th>Kalan</th>
                            <th>Durum</th>
                            <th>Ücret</th>
                            <th>Kapasite</th>
                            <th>Aktif</th>
                            <th>Sipariş</th>
                            <th>Koltuk</th>
                            <th>Gelir</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paged.map((t) => {
                            const m = minutesLeft(t.departure_time);
                            const closing = m <= 60 && m >= 0;
                            const past = m < 0;
                            const rowCls = past ? "opacity-60" : closing ? "bg-amber-50" : "";
                            return (
                                <tr key={t.id} className={`border-t ${rowCls}`}>
                                    <td className="py-2">{t.trip}</td>
                                    <td>{t.company_name || t.company?.name || "-"}</td>
                                    <td>
                                        {t.terminal_from} → {t.terminal_to}
                                    </td>
                                    <td>{fmtTR(t.departure_time)}</td>
                                    <td>{Number.isFinite(m) ? (m < 0 ? "—" : `${m} dk`) : "-"}</td>
                                    <td>
                                        {past && (
                                            <span className="px-2 py-1 rounded-lg text-xs border">Geçti</span>
                                        )}
                                        {!past && closing && (
                                            <span className="px-2 py-1 rounded-lg text-xs border border-amber-300 bg-amber-100">
                          Son Saat
                        </span>
                                        )}
                                        {!past && !closing && (
                                            <span className="px-2 py-1 rounded-lg text-xs border">Normal</span>
                                        )}
                                    </td>
                                    <td>{fmtTL(t.cost)}</td>
                                    <td>{t.capacity_reservation}</td>
                                    <td>{t.is_active ? "Evet" : "Hayır"}</td>
                                    <td>{toNum(t.orders)}</td>
                                    <td>{toNum(t.seats)}</td>
                                    <td>{fmtTL(t.revenue)}</td>
                                </tr>
                            );
                        })}
                        {!paged.length && !loading && (
                            <tr>
                                <td colSpan={12} className="py-6 text-center text-indigo-900/50">
                                    Kayıt yok
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                    {paged.map((t) => {
                        const m = minutesLeft(t.departure_time);
                        const closing = m <= 60 && m >= 0;
                        const past = m < 0;
                        return (
                            <div
                                key={t.id}
                                className={`rounded-2xl border bg-white p-4 shadow-sm ${past ? "opacity-60" : ""}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-semibold">{t.trip ?? `${t.terminal_from} → ${t.terminal_to}`}</div>
                                        <div className="text-xs text-indigo-900/60">
                                            {t.company_name || t.company?.name || "-"}
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <div className="text-sm font-medium">{fmtTL(t.revenue)}</div>
                                        <div className="text-xs text-indigo-900/60">{fmtTL(t.cost)}</div>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-indigo-900/70">
                                    <div>
                                        <div className="text-xs">Kalkış</div>
                                        <div className="font-medium">{fmtTR(t.departure_time)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs">Kalan</div>
                                        <div className="font-medium">{Number.isFinite(m) ? (m < 0 ? "—" : `${m} dk`) : "-"}</div>
                                    </div>

                                    <div>
                                        <div className="text-xs">Güzergah</div>
                                        <div className="font-medium">{t.terminal_from} → {t.terminal_to}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs">Koltuk / Sipariş</div>
                                        <div className="font-medium">{toNum(t.seats)} / {toNum(t.orders)}</div>
                                    </div>

                                    <div>
                                        <div className="text-xs">Kapasite</div>
                                        <div className="font-medium">{t.capacity_reservation}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs">Durum</div>
                                        <div className="font-medium">
                                            {past ? "Geçti" : closing ? "Son Saat" : "Normal"}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="text-sm text-indigo-900/60">Aktif: {t.is_active ? "Evet" : "Hayır"}</div>
                                    <div className="flex gap-2">
                                        <button className="px-3 py-1 rounded-lg border text-sm">Detay</button>
                                        <button className={`px-3 py-1 rounded-lg border text-sm ${closing || past ? "opacity-50 cursor-not-allowed" : ""}`} disabled={closing || past}>
                                            Yönet
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {!paged.length && !loading && (
                        <div className="rounded-xl border bg-white p-6 text-center text-indigo-900/50">Kayıt yok</div>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> sefer</div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Önceki
                        </button>
                        <span className="text-sm">{page} / {totalPages}</span>
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Sonraki
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
