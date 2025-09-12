"use client";

import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import DataTable, { TableColumn } from "react-data-table-component";
import { myAppHook } from "../../../../context/AppProvider";
import { api } from "../../lib/api";
import { toast } from "react-hot-toast";
import { CheckCircle2, XCircle, Pencil, Eye, Trash2, Plus } from "lucide-react";

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

const customStyles = {
    headCells: { style: { backgroundColor: "#f3f4f6", fontWeight: 600, padding: "12px" } },
    cells: { style: { padding: "12px" } },
};

const toLocalInputValue = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
    )}`;
};

export default function PersonnelDash() {
    const router = useRouter();
    const { user, token } = myAppHook() as any;

    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) {
            router.push("/auth");
        } else if (user.role !== "personnel") {
            router.push("/dashboard/passenger");
        } else {
            (async () => {
                setLoading(true);
                try {
                    const res = await api.get("/products", token);
                    const data = await api.json<{ products: Trip[] }>(res);
                    setTrips(data.products || []);
                } catch (e: any) {
                    toast.error("Sefer listesi alınamadı");
                    setTrips([]);
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [user, router, token]);

    const [showProfile, setShowProfile] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
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
        } catch {
            toast.error("Profil güncellenemedi");
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
        } catch (err: any) {
            toast.error(err?.message || "Şifre güncellenemedi");
        }
    };

    const emptyForm = {
        trip: "",
        company_name: "",
        terminal_from: "",
        terminal_to: "",
        departure_time: "",
        cost: 0,
        capacity_reservation: 0,
        is_active: true,
        note: "",
    };
    const [form, setForm] = useState(emptyForm);
    const onChangeForm = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target as any;
        setForm((s) => ({
            ...s,
            [name]: type === "checkbox" ? checked : name === "cost" || name === "capacity_reservation" ? Number(value) : value,
        }));
    };

    // Create
    const onSubmitCreate = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post("/products", form, token);
            const data = await api.json<{ product: Trip }>(res);
            setTrips((arr) => [data.product, ...arr]);
            setForm(emptyForm);
            toast.success("Sefer eklendi");
        } catch {
            toast.error("Sefer eklenemedi");
        }
    };

    // Edit
    const [editRow, setEditRow] = useState<Trip | null>(null);
    const onSubmitEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editRow) return;

        const payload = {
            trip: editRow.trip,
            company_name: editRow.company_name,
            terminal_from: editRow.terminal_from,
            terminal_to: editRow.terminal_to,
            departure_time: editRow.departure_time,
            cost: Number(editRow.cost),
            capacity_reservation: Number(editRow.capacity_reservation),
            is_active: !!editRow.is_active,
            note: editRow.note,
        };

        try {
            const res = await api.put(`/products/${editRow.id}`, payload, token);
            const data = await api.json<{ product: Trip }>(res);
            setTrips((arr) => arr.map((t) => (t.id === data.product.id ? data.product : t)));
            setEditRow(null);
            toast.success("Sefer güncellendi");
        } catch {
            toast.error("Sefer güncellenemedi");
        }
    };

    const [deleteRow, setDeleteRow] = useState<Trip | null>(null);
    const handleDelete = async () => {
        if (!deleteRow) return;
        try {
            await api.delete(`/products/${deleteRow.id}`, token);
            setTrips((arr) => arr.filter((t) => t.id !== deleteRow.id));
            toast.success("Sefer silindi");
        } catch {
            toast.error("Sefer silinemedi");
        } finally {
            setDeleteRow(null);
        }
    };

    const [viewRow, setViewRow] = useState<Trip | null>(null);

    const [q, setQ] = useState("");
    const [onlyActive, setOnlyActive] = useState(false);
    const filtered = useMemo(() => {
        const byText = (t: Trip) =>
            [t.trip, t.company_name, t.terminal_from, t.terminal_to, t.created_by, t.note ?? ""]
                .join(" ")
                .toLowerCase()
                .includes(q.toLowerCase());
        const byActive = (t: Trip) => (!onlyActive ? true : t.is_active);
        return trips.filter((t) => byText(t) && byActive(t));
    }, [trips, q, onlyActive]);

    const activeCount = useMemo(() => trips.filter((t) => t.is_active).length, [trips]);

    const columns: TableColumn<Trip>[] = useMemo(
        () => [
            { name: "ID", selector: (r) => r.id, sortable: true, width: "76px" },
            { name: "Firma", selector: (r) => r.company_name, sortable: true },
            { name: "Sefer", selector: (r) => r.trip, sortable: true },
            { name: "Kalkış", selector: (r) => r.terminal_from, sortable: true },
            { name: "Varış", selector: (r) => r.terminal_to, sortable: true },
            {
                name: "Tarih/Saat",
                selector: (r) => new Date(r.departure_time).toLocaleString(),
                sortable: true,
            },
            { name: "Ücret", selector: (r) => `₺${r.cost}`, sortable: true },
            {
                name: "Durum",
                cell: (r) => (
                    <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            r.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                    >
            {r.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {r.is_active ? "Aktif" : "Pasif"}
          </span>
                ),
                sortable: true,
                width: "110px",
            },
            {
                name: "İşlemler",
                cell: (r) => (
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setViewRow(r)}
                            className="px-2 py-1 text-xs rounded bg-zinc-700 text-white inline-flex items-center gap-1"
                            title="Görüntüle"
                        >
                            <Eye size={14} /> Gör
                        </button>
                        <button
                            onClick={() =>
                                setEditRow({
                                    ...r,
                                    departure_time: toLocalInputValue(r.departure_time),
                                })
                            }
                            className="px-2 py-1 text-xs rounded bg-amber-500 text-white inline-flex items-center gap-1"
                            title="Düzenle"
                        >
                            <Pencil size={14} /> Düzenle
                        </button>
                        <button
                            onClick={() => setDeleteRow(r)}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white inline-flex items-center gap-1"
                            title="Sil"
                        >
                            <Trash2 size={14} /> Sil
                        </button>
                    </div>
                ),
                ignoreRowClick: true,
            },
        ],
        []
    );

    return (
        <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-indigo-900">Personel Paneli</h2>
                    <p className="text-sm text-indigo-900/60">Sefer ekleyin, düzenleyin ve yönetin.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-white  text-black  px-4 py-2 text-sm">
                        Toplam sefer: <b>{trips.length}</b> • Aktif: <b>{activeCount}</b>
                    </div>
                    <button
                        onClick={() => setShowProfile(true)}
                        className="px-3 py-2 rounded-xl border bg-white text-indigo-700 hover:bg-indigo-50"
                    >
                        Hesap Bilgisi
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 text-indigo-900 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold">Yeni Sefer Ekle</h4>
                    <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">
            <Plus size={14} /> Hızlı oluştur
          </span>
                </div>

                <form onSubmit={onSubmitCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm mb-1">Sefer Adı</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            name="trip"
                            value={form.trip}
                            onChange={onChangeForm}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Firma</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            name="company_name"
                            value={form.company_name}
                            onChange={onChangeForm}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Kalkış</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            name="terminal_from"
                            value={form.terminal_from}
                            onChange={onChangeForm}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Varış</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            name="terminal_to"
                            value={form.terminal_to}
                            onChange={onChangeForm}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Tarih / Saat</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            type="datetime-local"
                            name="departure_time"
                            value={form.departure_time}
                            onChange={onChangeForm}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Ücret</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            type="number"
                            name="cost"
                            value={form.cost}
                            onChange={onChangeForm}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1">Rezerve Koltuk</label>
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            type="number"
                            name="capacity_reservation"
                            value={form.capacity_reservation}
                            onChange={onChangeForm}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Not</label>
                        <textarea
                            className="w-full rounded-xl border px-3 py-2"
                            name="note"
                            value={form.note}
                            onChange={onChangeForm}
                        />
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                        <input type="checkbox" name="is_active" checked={form.is_active} onChange={onChangeForm} />
                        <span className="text-sm">Aktif</span>
                    </div>
                    <button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 md:col-span-2">
                        Kaydet
                    </button>
                </form>
            </div>

            <div className="rounded-2xl border bg-white text-black p-4 shadow-sm flex items-center gap-3 flex-wrap">
                <input
                    className="w-full md:w-80 rounded-xl border px-3 py-2"
                    placeholder="Ara (firma, sefer, terminal...)"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
                    <span>Yalnız aktif</span>
                </label>
                <span className="text-sm text-zinc-500 ml-auto">{filtered.length} kayıt</span>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm overflow-x-auto">
                <DataTable
                    columns={columns}
                    data={filtered}
                    pagination
                    highlightOnHover
                    striped
                    customStyles={customStyles}
                    progressPending={loading}
                    conditionalRowStyles={[
                        {
                            when: (row: Trip) => !row.is_active,
                            style: { opacity: 0.6 },
                        },
                    ]}
                    noDataComponent={<div className="py-8 text-gray-500">Sefer bulunamadı.</div>}
                />
            </div>

            {showProfile && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 text-indigo-900 shadow-xl border">
                        <div className="flex justify-between mb-3">
                            <h3 className="text-lg font-semibold">Hesap Bilgisi</h3>
                            <button onClick={() => setShowProfile(false)} className="text-sm text-zinc-600">
                                Kapat
                            </button>
                        </div>
                        <form onSubmit={handleProfileSave} className="space-y-3">
                            <div>
                                <label className="block text-sm mb-1">Ad Soyad</label>
                                <input
                                    className="w-full rounded-xl border px-3 py-2"
                                    name="name"
                                    value={profile.name}
                                    onChange={onChangeProfile}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">E-posta</label>
                                <input
                                    className="w-full rounded-xl border px-3 py-2"
                                    name="email"
                                    value={profile.email}
                                    onChange={onChangeProfile}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Telefon</label>
                                <input
                                    className="w-full rounded-xl border px-3 py-2"
                                    name="phone"
                                    value={profile.phone}
                                    onChange={onChangeProfile}
                                />
                            </div>
                            <div className="flex justify-between gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(true)}
                                    className="px-3 py-2 border rounded-xl w-1/2 hover:bg-gray-50"
                                >
                                    Şifre Değiştir
                                </button>
                                <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl w-1/2">
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPwd && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <form
                        onSubmit={submitPwd}
                        className="w-full max-w-md rounded-2xl bg-white p-5 space-y-3 text-indigo-900 shadow-xl border"
                    >
                        <h3 className="text-lg font-semibold mb-2">Şifre Değiştir</h3>
                        <input
                            type="password"
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Mevcut şifre"
                            value={pwdForm.current_password}
                            onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                        />
                        <input
                            type="password"
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Yeni şifre"
                            value={pwdForm.password}
                            onChange={(e) => setPwdForm({ ...pwdForm, password: e.target.value })}
                        />
                        <input
                            type="password"
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Yeni şifre (tekrar)"
                            value={pwdForm.password_confirmation}
                            onChange={(e) => setPwdForm({ ...pwdForm, password_confirmation: e.target.value })}
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowPwd(false)}
                                className="px-3 py-2 border rounded-xl hover:bg-gray-50"
                            >
                                Vazgeç
                            </button>
                            <button className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Kaydet</button>
                        </div>
                    </form>
                </div>
            )}

            {viewRow && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-5 text-indigo-900 shadow-xl border">
                        <div className="text-lg font-semibold mb-3">Sefer Detayı</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                                <b>ID:</b> {viewRow.id}
                            </div>
                            <div>
                                <b>Sefer:</b> {viewRow.trip}
                            </div>
                            <div>
                                <b>Firma:</b> {viewRow.company_name}
                            </div>
                            <div>
                                <b>Kalkış:</b> {viewRow.terminal_from}
                            </div>
                            <div>
                                <b>Varış:</b> {viewRow.terminal_to}
                            </div>
                            <div>
                                <b>Tarih/Saat:</b> {new Date(viewRow.departure_time).toLocaleString()}
                            </div>
                            <div>
                                <b>Ücret:</b> ₺{viewRow.cost}
                            </div>
                            <div>
                                <b>Rezerve:</b> {viewRow.capacity_reservation}
                            </div>
                            <div className="md:col-span-2">
                                <b>Durum:</b>{" "}
                                <span
                                    className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                                        viewRow.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                    }`}
                                >
                  {viewRow.is_active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                    {viewRow.is_active ? "Aktif" : "Pasif"}
                </span>
                            </div>
                            <div className="md:col-span-2">
                                <b>Not:</b> {viewRow.note ?? "-"}
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setViewRow(null)}>
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editRow && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <form
                        onSubmit={onSubmitEdit}
                        className="w-full max-w-xl rounded-2xl bg-white p-5 space-y-3 text-indigo-900 shadow-xl border"
                    >
                        <h3 className="text-lg font-semibold mb-2">Sefer Düzenle</h3>

                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            value={editRow.trip}
                            onChange={(e) => setEditRow({ ...editRow, trip: e.target.value })}
                            placeholder="Sefer adı"
                        />
                        <input
                            className="w-full rounded-xl border px-3 py-2"
                            value={editRow.company_name}
                            onChange={(e) => setEditRow({ ...editRow, company_name: e.target.value })}
                            placeholder="Firma"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                className="rounded-xl border px-3 py-2"
                                value={editRow.terminal_from}
                                onChange={(e) => setEditRow({ ...editRow, terminal_from: e.target.value })}
                                placeholder="Kalkış"
                            />
                            <input
                                className="rounded-xl border px-3 py-2"
                                value={editRow.terminal_to}
                                onChange={(e) => setEditRow({ ...editRow, terminal_to: e.target.value })}
                                placeholder="Varış"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                className="rounded-xl border px-3 py-2"
                                type="datetime-local"
                                value={editRow.departure_time}
                                onChange={(e) => setEditRow({ ...editRow, departure_time: e.target.value })}
                            />
                            <input
                                className="rounded-xl border px-3 py-2"
                                type="number"
                                value={editRow.cost}
                                onChange={(e) => setEditRow({ ...editRow, cost: Number(e.target.value) })}
                                placeholder="Ücret"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                                className="rounded-xl border px-3 py-2"
                                type="number"
                                value={editRow.capacity_reservation}
                                onChange={(e) => setEditRow({ ...editRow, capacity_reservation: Number(e.target.value) })}
                                placeholder="Rezerve Koltuk"
                            />
                            <label className="inline-flex items-center gap-2 border rounded-xl px-3 py-2">
                                <input
                                    type="checkbox"
                                    checked={!!editRow.is_active}
                                    onChange={(e) => setEditRow({ ...editRow, is_active: e.target.checked })}
                                />
                                Aktif
                            </label>
                        </div>

                        <textarea
                            className="w-full rounded-xl border px-3 py-2"
                            placeholder="Not"
                            value={editRow.note ?? ""}
                            onChange={(e) => setEditRow({ ...editRow, note: e.target.value })}
                        />

                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" className="px-3 py-2 rounded-xl border hover:bg-gray-50" onClick={() => setEditRow(null)}>
                                Vazgeç
                            </button>
                            <button className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" type="submit">
                                Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {deleteRow && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 text-indigo-900 shadow-xl border">
                        <h3 className="text-lg font-semibold mb-2">Sefer Sil</h3>
                        <p className="text-sm">Bu seferi silmek istediğinize emin misiniz?</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="px-3 py-2 rounded-xl border hover:bg-gray-50" onClick={() => setDeleteRow(null)}>
                                Vazgeç
                            </button>
                            <button className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>
                                Evet, sil
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
