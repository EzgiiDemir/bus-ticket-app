'use client';
import { useMemo } from "react";

type Trip = {
    id: number;
    trip?: string;
    company_name?: string;
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    cost: number | string;
    bus_type?: string | null;
    seat_map?: { layout?: "2+1" | "2+2" } | null;
};

function toDate(s?: string | null): Date | null {
    if (!s) return null;
    const norm = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(norm);
    return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTR(s?: string | null): string {
    const d = toDate(s);
    return d
        ? d.toLocaleString("tr-TR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
        : "";
}

/* ---------- DEĞİŞTİRİLDİ: cost gösterimi ---------- */
/* Eğer backend string gönderiyorsa olduğu gibi göster.
   Eğer number ise locale para formatına çevir. */
export default function TripList({
                                     rows,
                                     closingSoon,
                                     page,
                                     lastPage,
                                     onPrev,
                                     onNext,
                                     onBuy,
                                 }: {
    rows: Trip[];
    closingSoon: Set<number>;
    page: number;
    lastPage: number | null;
    onPrev: () => void;
    onNext: () => void;
    onBuy: (id: number) => void;
}) {
    const TRYc = useMemo(
        () =>
            new Intl.NumberFormat("tr-TR", {
                style: "currency",
                currency: "TRY",
                maximumFractionDigits: 2,
            }),
        []
    );

    const canNext = lastPage === null ? true : page < lastPage;

    const formatCost = (c: number | string | undefined) => {
        if (c === undefined || c === null) return "";
        if (typeof c === "string") {
            // Backend tarafından gönderilen string tam olarak gösterilsin
            // (örnek: "400" veya "400,00" veya "₺400,00" gibi)
            return c;
        }
        // number ise locale ile para formatla
        return TRYc.format(Number(c || 0));
    };

    return (
        <div className="rounded-2xl bg-white p-4 shadow ">
            {/* Desktop */}
            <table className="hidden md:table min-w-[980px] w-full text-sm">
                <thead>
                <tr className="text-left text-indigo-900/60">
                    <th className="py-2">Firma</th>
                    <th>Sefer</th>
                    <th>Kalkış</th>
                    <th>Varış</th>
                    <th>Tarih/Saat</th>
                    <th>Ücret</th>
                    <th>Düzen</th>
                    <th className="text-right">İşlem</th>
                </tr>
                </thead>
                <tbody>
                {rows.map((r) => {
                    const soon = closingSoon.has(r.id);
                    const cost = formatCost(r.cost);
                    const layout = (r.bus_type || r.seat_map?.layout || "-") as string;
                    return (
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.company_name || "-"}</td>
                            <td className="font-medium">{r.trip || "-"}</td>
                            <td>{r.terminal_from}</td>
                            <td>{r.terminal_to}</td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <span>{fmtDateTR(r.departure_time)}</span>
                                    {soon && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border">
                        Kapanmak Üzere
                      </span>
                                    )}
                                </div>
                            </td>
                            <td>{cost}</td>
                            <td>{layout}</td>
                            <td className="text-right">
                                <button
                                    type="button"
                                    className={`px-3 py-1 rounded-lg border ${soon ? "opacity-50 cursor-not-allowed" : ""}`}
                                    onClick={() => onBuy(r.id)}
                                    disabled={soon}
                                    aria-disabled={soon}
                                    title={soon ? "Kalkışa ≤60 dk. kala satış durdurulur" : "Satın al"}
                                >
                                    Satın Al
                                </button>
                            </td>
                        </tr>
                    );
                })}
                {!rows.length && (
                    <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                            Kayıt yok.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
                {rows.map((r) => {
                    const soon = closingSoon.has(r.id);
                    const cost = formatCost(r.cost);
                    const layout = (r.bus_type || r.seat_map?.layout || "-") as string;
                    return (
                        <div key={r.id} className="rounded-2xl border bg-white p-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">{r.trip ?? "-"}</div>
                                <span className="text-xs px-2 py-1 rounded-lg border">{r.company_name ?? "-"}</span>
                            </div>
                            <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Güzergâh</div>
                                <div>
                                    {r.terminal_from} → {r.terminal_to}
                                </div>
                                <div className="text-indigo-900/60">Kalkış</div>
                                <div>{fmtDateTR(r.departure_time)}</div>
                                <div className="text-indigo-900/60">Ücret</div>
                                <div>{cost}</div>
                                <div className="text-indigo-900/60">Düzen</div>
                                <div>{layout}</div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    className={`px-3 py-2 rounded-lg border ${soon ? "opacity-50 cursor-not-allowed" : ""}`}
                                    onClick={() => onBuy(r.id)}
                                    disabled={soon}
                                    aria-disabled={soon}
                                    title={soon ? "Kalkışa ≤60 dk. kala satış durdurulur" : "Satın al"}
                                >
                                    Satın Al
                                </button>
                            </div>
                        </div>
                    );
                })}
                {!rows.length && <div className="py-6 text-center text-gray-500">Kayıt yok.</div>}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    Sayfa {page}
                    {lastPage ? ` / ${lastPage}` : ""}
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border disabled:opacity-50"
                        disabled={page <= 1}
                        onClick={onPrev}
                        aria-disabled={page <= 1}
                    >
                        Geri
                    </button>
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border disabled:opacity-50"
                        disabled={!canNext}
                        onClick={onNext}
                        aria-disabled={!canNext}
                    >
                        Daha Fazla Yükle
                    </button>
                </div>
            </div>
        </div>
    );
}
