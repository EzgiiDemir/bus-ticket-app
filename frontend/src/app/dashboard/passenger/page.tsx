"use client";

import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import DataTable, { TableColumn } from "react-data-table-component";
import { myAppHook } from "../../../../context/AppProvider";
import { api } from "../../lib/api";
import { toast } from "react-hot-toast";

type Trip = {
    id: number;
    trip: string;
    company_name: string;
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    cost: number;
    capacity_reservation: number;
    is_active: boolean;
    note?: string;
    created_by: string;
};

type Order = {
    id: number;
    product?: Trip | null;
    qty: number;
    unit_price: number;
    total: number;
    passenger_name: string;
    passenger_email: string;
    passenger_phone?: string;
    pnr: string;
    status: string;
    created_at?: string;
};

const customStyles = {
    headCells: { style: { backgroundColor: "#f3f4f6", fontWeight: 600, padding: "12px" } },
    cells: { style: { padding: "12px" } },
};

export default function PassengerDash() {
    const router = useRouter();
    const { user, token } = myAppHook() as any;

    const [trips, setTrips] = useState<Trip[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return router.push("/auth");
        if (user.role !== "passenger") return router.push("/dashboard/personnel");

        (async () => {
            setLoading(true);
            try {
                const res = await api.get("/products", token);
                const data = await api.json<{ products: Trip[] }>(res);
                setTrips(data.products ?? []);
            } catch (e: any) {
                toast.error(e?.message || "Seferler yüklenemedi");
            }

            try {
                const res2 = await api.get("/orders", token);
                const data2 = await api.json<{ orders: Order[] }>(res2);
                setOrders(data2.orders ?? []);
            } catch (e: any) {
                toast.error(e?.message || "Siparişler yüklenemedi");
            }
            setLoading(false);
        })();
    }, [user, router, token]);

    const [showProfile, setShowProfile] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [showLastOrders, setShowLastOrders] = useState(false);

    const [profile, setProfile] = useState({
        name: user?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone ?? "",
    });
    const [pwdForm, setPwdForm] = useState({ current_password: "", password: "", password_confirmation: "" });

    const onChangeProfile = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile((s) => ({ ...s, [name]: value }));
    };
    const handleProfileSave = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.put("/me", profile, token);
            await api.json(res);
            toast.success("Profil güncellendi");
            setShowProfile(false);
        } catch (e: any) {
            toast.error(e?.message || "Profil güncellenemedi");
        }
    };
    const submitPwd = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.put("/me/password", pwdForm, token);
            await api.json(res);
            toast.success("Şifre güncellendi");
            setPwdForm({ current_password: "", password: "", password_confirmation: "" });
            setShowPwd(false);
        } catch (e: any) {
            toast.error(e?.message || "Şifre güncellenemedi");
        }
    };

    const [reserveTrip, setReserveTrip] = useState<Trip | null>(null);
    const [buying, setBuying] = useState(false);
    const [reserveForm, setReserveForm] = useState({
        passenger_name: "",
        passenger_email: "",
        passenger_phone: "",
        qty: 1,
        // Payment (mock)
        card_name: "",
        card_number: "",
        card_month: "",
        card_year: "",
        card_cvv: "",
    });

    const submitReserve = async (e: FormEvent) => {
        e.preventDefault();
        if (!reserveTrip) return;
        if (
            !reserveForm.card_name ||
            !/^\d{16}$/.test(reserveForm.card_number.replace(/\s+/g, "")) ||
            !/^\d{2}$/.test(reserveForm.card_month) ||
            !/^\d{2}$/.test(reserveForm.card_year) ||
            !/^\d{3,4}$/.test(reserveForm.card_cvv)
        ) {
            return toast.error("Kart bilgilerini kontrol edin");
        }

        setBuying(true);
        try {
            const payment_token = `mock_${Date.now()}`;

            const res = await api.post(
                "/orders",
                {
                    product_id: reserveTrip.id,
                    qty: Number(reserveForm.qty),
                    passenger_name: reserveForm.passenger_name,
                    passenger_email: reserveForm.passenger_email,
                    passenger_phone: reserveForm.passenger_phone || null,
                    payment_token,
                },
                token
            );
            const data = await api.json<{ order: Order }>(res);

            setOrders((arr) => [data.order, ...arr]);
            toast.success(`Satın alındı • PNR: ${data.order.pnr}`);
            setReserveTrip(null);
            setReserveForm({
                passenger_name: "",
                passenger_email: "",
                passenger_phone: "",
                qty: 1,
                card_name: "",
                card_number: "",
                card_month: "",
                card_year: "",
                card_cvv: "",
            });
        } catch (e: any) {
            toast.error(e?.message || "Satın alma başarısız");
        } finally {
            setBuying(false);
        }
    };

    const [q, setQ] = useState("");
    const [searching, setSearching] = useState(false);

    const filteredTrips = useMemo(() => {
        if (!q.trim()) return trips;
        const x = q.toLowerCase();
        return trips.filter((t) =>
            [t.trip, t.company_name, t.terminal_from, t.terminal_to, t.note ?? ""]
                .join(" ")
                .toLowerCase()
                .includes(x)
        );
    }, [trips, q]);

    const serverSearch = async () => {
        setSearching(true);
        try {
            const url = q.trim() ? `/products?search=${encodeURIComponent(q.trim())}` : "/products";
            const res = await api.get(url, token);
            const data = await api.json<{ products?: Trip[] }>(res);
            if (Array.isArray(data.products)) {
                setTrips(data.products);
                toast.success(`Sunucudan ${data.products.length} sonuç geldi`);
            } else {
                toast("Sunucu araması desteklenmiyor, yerel arama kullanılıyor", { icon: "ℹ️" });
            }
        } catch (e: any) {
            toast.error(e?.message || "Sunucu araması başarısız");
        } finally {
            setSearching(false);
        }
    };

    const tripColumns: TableColumn<Trip>[] = useMemo(
        () => [
            {
                name: "Firma / Sefer",
                selector: (r) => `${r.company_name} • ${r.trip}`,
                sortable: true,
                grow: 2,
            },
            {
                name: "Hat",
                selector: (r) => `${r.terminal_from} → ${r.terminal_to}`,
                sortable: true,
            },
            {
                name: "Tarih/Saat",
                selector: (r) => (r.departure_time ? new Date(r.departure_time).toLocaleString() : "-"),
                sortable: true,
            },
            { name: "Ücret", selector: (r) => `₺${r.cost}`, sortable: true },
            {
                name: "Durum",
                selector: (r) => (r.is_active ? "Aktif" : "Pasif"),
                width: "100px",
            },
            {
                name: "",
                cell: (r) => (
                    <button
                        onClick={() => setReserveTrip(r)}
                        className="px-3 py-1.5 text-xs rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        Satın Al
                    </button>
                ),
                width: "120px",
            },
        ],
        []
    );

    const orderColumns: TableColumn<Order>[] = useMemo(
        () => [
            { name: "PNR", selector: (o) => o.pnr },
            { name: "Sefer", selector: (o) => o.product?.trip ?? "-" },
            { name: "Firma", selector: (o) => o.product?.company_name ?? "-" },
            {
                name: "Tarih",
                selector: (o) =>
                    o.product?.departure_time ? new Date(o.product.departure_time).toLocaleDateString() : "-",
            },
            { name: "Ad Soyad", selector: (o) => o.passenger_name },
            { name: "Adet", selector: (o) => (o.qty ?? 0).toString() },
            { name: "Tutar", selector: (o) => `₺${o.total ?? 0}` },
            { name: "Durum", selector: (o) => o.status ?? "-" },
        ],
        []
    );

    const last5Orders = useMemo(() => orders.slice(0, 5), [orders]);

    return (
        <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <button
                    onClick={() => setShowLastOrders(true)}
                    className="px-3 py-2 rounded-xl border bg-white text-black"
                >
                    Satın Aldığım Biletler
                </button>
                <button
                    onClick={() => setShowProfile(true)}
                    className="px-3 py-2 rounded-xl border bg-white text-black"
                >
                    Hesap Bilgisi
                </button>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white text-black p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h4 className="text-lg font-semibold">Otobüs Bileti Ara</h4>
                        <p className="text-sm text-zinc-500">Firma, sefer adı veya terminal yazın. Anında filtrelenir.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            className="w-72 rounded-xl border px-3 py-2"
                            placeholder="Örn: Metro – Ankara – AŞTİ"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                        <button
                            onClick={serverSearch}
                            disabled={searching}
                            className="px-3 py-2 rounded-xl bg-zinc-900 text-white disabled:opacity-60"
                            title="Sunucudan ara"
                        >
                            {searching ? "Aranıyor..." : "Sunucudan Ara"}
                        </button>
                    </div>
                </div>

                <DataTable
                    columns={tripColumns}
                    data={filteredTrips}
                    pagination
                    highlightOnHover
                    striped
                    customStyles={customStyles}
                    progressPending={loading || searching}
                    subHeader
                    subHeaderComponent={
                        <div className="flex items-center gap-2 w-full">
              <span className="text-sm text-zinc-500">
                {q ? `Filtre: “${q}” • ` : ""}Toplam sefer: {filteredTrips.length}
              </span>
                        </div>
                    }
                />
            </div>



            {showProfile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 text-black">
                        <div className="flex justify-between mb-3">
                            <h3 className="text-lg font-semibold">Hesap Bilgisi</h3>
                            <button onClick={() => setShowProfile(false)} className="text-sm">Kapat</button>
                        </div>
                        <form onSubmit={handleProfileSave} className="space-y-2">
                            <input className="w-full rounded-xl border px-3 py-2" name="name" placeholder="Ad Soyad" value={profile.name} onChange={onChangeProfile} />
                            <input className="w-full rounded-xl border px-3 py-2" name="email" placeholder="E-posta" value={profile.email} onChange={onChangeProfile} />
                            <input className="w-full rounded-xl border px-3 py-2" name="phone" placeholder="Telefon" value={profile.phone} onChange={onChangeProfile} />
                            <div className="flex justify-between">
                                <button type="button" onClick={() => setShowPwd(true)} className="px-3 py-2 border rounded-xl">
                                    Şifre Değiştir
                                </button>
                                <button className="px-3 py-2 bg-zinc-900 text-white rounded-xl">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPwd && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <form onSubmit={submitPwd} className="w-full max-w-md rounded-2xl bg-white p-5 space-y-2 text-black">
                        <h3 className="text-lg font-semibold mb-2">Şifre Değiştir</h3>
                        <input type="password" className="w-full rounded-xl border px-3 py-2" placeholder="Mevcut şifre" value={pwdForm.current_password} onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })} />
                        <input type="password" className="w-full rounded-xl border px-3 py-2" placeholder="Yeni şifre" value={pwdForm.password} onChange={(e) => setPwdForm({ ...pwdForm, password: e.target.value })} />
                        <input type="password" className="w-full rounded-xl border px-3 py-2" placeholder="Yeni şifre (tekrar)" value={pwdForm.password_confirmation} onChange={(e) => setPwdForm({ ...pwdForm, password_confirmation: e.target.value })} />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowPwd(false)} className="px-3 py-2 border rounded-xl">
                                Vazgeç
                            </button>
                            <button className="px-3 py-2 bg-zinc-900 text-white rounded-xl">Kaydet</button>
                        </div>
                    </form>
                </div>
            )}

            {showLastOrders && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-3xl rounded-2xl bg-white p-5 text-black">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-semibold">Son 5 Biletim</h3>
                            <button onClick={() => setShowLastOrders(false)} className="text-sm">Kapat</button>
                        </div>
                        <DataTable
                            columns={orderColumns}
                            data={last5Orders}
                            pagination
                            paginationPerPage={5}
                            highlightOnHover
                            striped
                            customStyles={customStyles}
                        />
                    </div>
                </div>
            )}

            {reserveTrip && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <form onSubmit={submitReserve} className="w-full max-w-xl rounded-2xl bg-white p-5 space-y-3 text-black">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold mb-1">Bilet Satın Al</h3>
                                <p className="text-sm text-zinc-500">
                                    <b>{reserveTrip.company_name}</b> • {reserveTrip.trip}
                                    <br />
                                    {reserveTrip.terminal_from} → {reserveTrip.terminal_to} •{" "}
                                    {new Date(reserveTrip.departure_time).toLocaleString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-zinc-500">Ücret</div>
                                <div className="text-base font-semibold">₺{reserveTrip.cost}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input className="rounded-xl border px-3 py-2" placeholder="Ad Soyad"
                                   value={reserveForm.passenger_name}
                                   onChange={(e) => setReserveForm({ ...reserveForm, passenger_name: e.target.value })}
                                   required />
                            <input className="rounded-xl border px-3 py-2" type="email" placeholder="E-posta"
                                   value={reserveForm.passenger_email}
                                   onChange={(e) => setReserveForm({ ...reserveForm, passenger_email: e.target.value })}
                                   required />
                            <input className="rounded-xl border px-3 py-2" placeholder="Telefon"
                                   value={reserveForm.passenger_phone}
                                   onChange={(e) => setReserveForm({ ...reserveForm, passenger_phone: e.target.value })} />
                            <input className="rounded-xl border px-3 py-2" type="number" min={1} max={10} placeholder="Adet"
                                   value={reserveForm.qty}
                                   onChange={(e) => setReserveForm({ ...reserveForm, qty: Number(e.target.value) })} />
                        </div>

                        <div className="rounded-xl border p-3">
                            <div className="text-sm font-semibold mb-2">Ödeme (Kart)</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input className="rounded-xl border px-3 py-2" placeholder="Kart Üzerindeki İsim"
                                       value={reserveForm.card_name}
                                       onChange={(e) => setReserveForm({ ...reserveForm, card_name: e.target.value })} />
                                <input className="rounded-xl border px-3 py-2" placeholder="Kart Numarası (16 hane)"
                                       value={reserveForm.card_number}
                                       onChange={(e) => setReserveForm({ ...reserveForm, card_number: e.target.value.replace(/[^\d]/g, "") })} />
                                <div className="grid grid-cols-3 gap-2">
                                    <input className="rounded-xl border px-3 py-2" placeholder="AA"
                                           value={reserveForm.card_month}
                                           onChange={(e) => setReserveForm({ ...reserveForm, card_month: e.target.value.replace(/[^\d]/g, "").slice(0,2) })} />
                                    <input className="rounded-xl border px-3 py-2" placeholder="YY"
                                           value={reserveForm.card_year}
                                           onChange={(e) => setReserveForm({ ...reserveForm, card_year: e.target.value.replace(/[^\d]/g, "").slice(0,2) })} />
                                    <input className="rounded-xl border px-3 py-2" placeholder="CVV"
                                           value={reserveForm.card_cvv}
                                           onChange={(e) => setReserveForm({ ...reserveForm, card_cvv: e.target.value.replace(/[^\d]/g, "").slice(0,4) })} />
                                </div>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                                Ödeme demo amaçlıdır; kart bilgileriniz sunucuya token olarak iletilir.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setReserveTrip(null)} className="px-3 py-2 rounded-xl border">
                                Vazgeç
                            </button>
                            <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-60"
                                    disabled={buying}>
                                {buying ? "Ödeniyor…" : "Ödeme Yap & Satın Al"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
