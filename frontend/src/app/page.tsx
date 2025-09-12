"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DataTable, { TableColumn } from "react-data-table-component";
import { api } from "./lib/api";

type Trip = {
    id: number;
    trip: string;
    company_name: string;
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    cost: number;
    is_active: boolean;
};

const customStyles = {
    headCells: { style: { backgroundColor: "#f3f4f6", fontWeight: 600, padding: "12px" } },
    cells: { style: { padding: "12px" } },
};

function toLocal(dt: string) {
    if (!dt) return "-";
    const s = dt.includes("T") ? dt : dt.replace(" ", "T");
    const d = new Date(s);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString();
}

export default function Home() {
    const [loading, setLoading] = useState(false);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [q, setQ] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [date, setDate] = useState(""); // YYYY-MM-DD

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await api.get("/public/products");
                const data = await api.json<{ status: boolean; products: Trip[] }>(res);
                setTrips((data.products || []).filter((t) => t.is_active));
            } catch (e) {
                console.error(e);
                setTrips([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const uniqueFrom = useMemo(
        () => Array.from(new Set(trips.map((t) => t.terminal_from))).sort(),
        [trips]
    );
    const uniqueTo = useMemo(
        () => Array.from(new Set(trips.map((t) => t.terminal_to))).sort(),
        [trips]
    );

    const filtered = useMemo(() => {
        return trips.filter((t) => {
            const text = [t.trip, t.company_name, t.terminal_from, t.terminal_to]
                .join(" ")
                .toLowerCase();
            const byQ = !q || text.includes(q.toLowerCase());
            const byFrom = !from || t.terminal_from === from;
            const byTo = !to || t.terminal_to === to;
            const byDate = !date || (t.departure_time && t.departure_time.slice(0, 10) === date);
            return byQ && byFrom && byTo && byDate;
        });
    }, [trips, q, from, to, date]);

    const columns: TableColumn<Trip>[] = useMemo(
        () => [
            { name: "Firma", selector: (r) => r.company_name, sortable: true },
            { name: "Sefer", selector: (r) => r.trip, sortable: true },
            { name: "Kalkış", selector: (r) => r.terminal_from, sortable: true },
            { name: "Varış", selector: (r) => r.terminal_to, sortable: true },
            {
                name: "Tarih/Saat",
                selector: (r) => toLocal(r.departure_time),
                sortable: true,
            },
            { name: "Ücret", selector: (r) => `₺${r.cost}`, sortable: true },
            {
                name: "İşlem",
                cell: (r) => (
                    <Link
                        href={`/auth?next=/dashboard/passenger&product=${r.id}`}
                        className="px-3 py-1 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 text-xs"
                    >
                        Satın Al (Giriş Yap)
                    </Link>
                ),
                ignoreRowClick: true,
            },
        ],
        []
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
            <section className="relative overflow-hidden">
                <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-200 blur-3xl opacity-50" />

                <div className="container mx-auto px-4 py-12 md:py-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-indigo-900">
                                Otobüs biletinizi online alın
                            </h1>
                            <p className="mt-4 text-lg text-indigo-900/70">
                                Türkiye’nin dört bir yanındaki seferleri tek ekranda görüntüleyin. Uygun fiyat, kolay arama, güvenli
                                ödeme.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link
                                    href="/auth"
                                    className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow hover:bg-indigo-700"
                                >
                                    Girişinizi Yapın
                                </Link>
                                <a
                                    href="#seferler"
                                    className="inline-flex items-center gap-2 bg-white text-indigo-700 px-5 py-3 rounded-xl shadow border border-indigo-100 hover:bg-indigo-50"
                                >
                                    Seferleri Gör
                                </a>
                            </div>


                        </div>

                        <div className="relative mx-auto">
                            <Image src="/otobus.jpg" alt="Otobüs bileti" width={640} height={420} loading="eager" />
                            <div className="absolute -bottom-4 -right-4 bg-white px-4 py-3 rounded-xl shadow border text-sm">
                                <div className="font-semibold text-black">Anında onay</div>
                                <div className="text-gray-500">PNR kodunuzu hemen alın</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="seferler" className="container mx-auto px-4 pb-12">
                <div className="rounded-2xl border bg-white p-5 shadow">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h2 className="text-2xl text-black font-bold">Güncel Seferler</h2>
                        <span className="text-sm text-gray-500">{filtered.length} sefer listeleniyor</span>
                    </div>

                    <DataTable
                        columns={columns}
                        data={filtered}
                        pagination
                        highlightOnHover
                        striped
                        customStyles={customStyles}
                        progressPending={loading}
                        noDataComponent={<div className="py-8 text-gray-500">Kriterlere uygun sefer bulunamadı.</div>}
                    />
                </div>
            </section>

            <section className="container mx-auto px-4 py-12 text-black">
                <h3 className="text-2xl md:text-3xl font-bold text-center">Neden bizi seçmelisiniz?</h3>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl p-6 shadow border">
                        <Image src="/globe.svg" alt="Ağ" width={48} height={48} loading="eager" />
                        <h4 className="mt-3 font-semibold text-lg">Geniş Sefer Ağı</h4>
                        <p className="text-gray-600">Her gün yüzlerce şehirler arası rota.</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow border">
                        <Image src="/window.svg" alt="Kolay" width={48} height={48} loading="eager" />
                        <h4 className="mt-3 font-semibold text-lg">Kolay & Hızlı</h4>
                        <p className="text-gray-600">Dakikalar içinde biletinizi alın.</p>
                    </div>
                    <div className="bg-white rounded-2xl p-6 shadow border">
                        <Image src="/file.svg" alt="Güvenli" width={48} height={48} loading="eager" />
                        <h4 className="mt-3 font-semibold text-lg">Güvenli Ödeme</h4>
                        <p className="text-gray-600">Verileriniz koruma altında.</p>
                    </div>
                </div>
            </section>

            <section className="bg-white/60 border-t text-black">
                <div className="container mx-auto px-4 py-12">
                    <h3 className="text-2xl md:text-3xl font-bold text-center">Nasıl çalışır?</h3>
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="rounded-2xl p-6 bg-white shadow border">
                            <div className="text-sm text-gray-500">1. Sefer bul</div>
                            <div className="font-semibold mt-1">Rota & tarih seç</div>
                        </div>
                        <div className="rounded-2xl p-6 bg-white shadow border">
                            <div className="text-sm text-gray-500">2. Giriş yap</div>
                            <div className="font-semibold mt-1">Hızlı üyelik veya giriş</div>
                        </div>
                        <div className="rounded-2xl p-6 bg-white shadow border">
                            <div className="text-sm text-gray-500">3. Ödeme</div>
                            <div className="font-semibold mt-1">PNR anında gelsin</div>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="bg-neutral-900 text-neutral-200 text-center py-8 mt-12">
                <p className="m-0">© {new Date().getFullYear()} BusX. Tüm hakları saklıdır.</p>
            </footer>
        </div>
    );
}
