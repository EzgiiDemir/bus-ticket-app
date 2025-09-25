'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { api } from '@/app/lib/api';
import { myAppHook } from '../../../../../context/AppProvider';
import { fmtTR } from '@/app/lib/datetime';
import { useRouter } from 'next/navigation';

/* ---------------- Types ---------------- */
type Trip = {
    id: number;
    trip?: string;
    company_name?: string;
    terminal_from: string;
    terminal_to: string;
    departure_time: string;
    cost: number | string;
    is_active: number | boolean;
    duration?: string;
    bus_type?: '2+1' | '2+2' | string;
    route?: { name: string; time?: string }[];
    capacity_reservation?: number | string;
    important_notes?: string | null;
    cancellation_policy?: string | null;
    created_at?: string;
};
type TripDetail = Trip & {
    disabled_seats?: { code: string; type: 'fault' | 'blocked'; label?: string; reason?: string }[];
    blocked_all?: string[];
    taken_seats?: string[];
    seat_map?: { layout?: '2+1' | '2+2'; rows?: number };
};
type PurchaseResp = { status: boolean; message?: string; order?: any; pnr?: string };
type ApiErr = { message?: string; errors?: Record<string, string[] | string> };

/* ---------------- Page ---------------- */
export default function PassengerTrips() {
    const { token, isLoading } = (myAppHook() as any) || {};

    const [rows, setRows] = useState<Trip[]>([]);
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [banner, setBanner] = useState('');
    const [detail, setDetail] = useState<TripDetail | null>(null);

    const [now, setNow] = useState<number>(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        setLoading(true);
        setErr('');
        setBanner('');
        (async () => {
            try {
                const res = await api.get('/public/products', { public: true });
                const data = await api.json<any>(res);
                const arr: Trip[] = data?.products || [];
                setRows(arr);
                setBanner(`Toplam ${arr.length} sefer listelendi.`);
            } catch (e: any) {
                const p: ApiErr | undefined = e?.response?.data ?? (e as any);
                setErr(p?.message || 'Seferler alınamadı.');
                setRows([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const minutesLeft = (dt: string) => {
        const s = dt.includes('T') ? dt : dt.replace(' ', 'T');
        const t = Date.parse(s);
        if (Number.isNaN(t)) return NaN;
        return Math.floor((t - now) / 60000);
    };

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(s)) : rows;
    }, [rows, q]);

    const closingSoon = useMemo(
        () =>
            filtered.filter(r => {
                const m = minutesLeft(r.departure_time);
                return Number.isFinite(m) && m > 0 && m <= 60;
            }),
        [filtered, now]
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
    const currency = useMemo(
        () => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
        []
    );

    const cols = [
        { key: 'trip', title: 'Sefer' },
        { key: 'company_name', title: 'Firma' },
        { key: 'route', title: 'Güzergâh', map: (r: Trip) => `${r.terminal_from} → ${r.terminal_to}` },
        { key: 'departure_time', title: 'Kalkış', map: (r: Trip) => fmtTR(r.departure_time) },
        { key: 'cost', title: 'Ücret', map: (r: Trip) => currency.format(Number(r.cost || 0)) },
        { key: 'duration', title: 'Süre' },
        { key: 'bus_type', title: 'Otobüs Tipi' }
    ] as const;

    const openDetail = async (id: number) => {
        if (isLoading) return;
        setLoading(true);
        setErr('');
        setBanner('');
        try {
            const res = await api.get(`/public/products/${id}`, { public: true });
            const data = await api.json<any>(res);
            const rowsCount = data.seat_map?.rows ?? 12;
            const layout = data.seat_map?.layout || data.bus_type || '2+1';
            setDetail({ ...data, seat_map: { rows: rowsCount, layout }, taken_seats: data.taken_seats || [] });
            setOpen(true);
        } catch (e: any) {
            const p: ApiErr | undefined = e?.response?.data ?? (e as any);
            setErr(p?.message || 'Sefer bulunamadı.');
        } finally {
            setLoading(false);
        }
    };

    const DisableBadge = ({ m }: { m: number }) => {
        if (!Number.isFinite(m)) return null;
        if (m <= 0)
            return (
                <span className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 border border-red-200">Kapandı</span>
            );
        if (m <= 60)
            return (
                <span className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
          Son {m} dk
        </span>
            );
        return null;
    };

    const isInactive = (r: Trip) => r.is_active === 0 || r.is_active === false;
    const router = useRouter();

    return (
        <div className="space-y-4 text-indigo-900">
            {banner && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {banner}
                </div>
            )}
            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            {closingSoon.length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
                    <div className="font-semibold text-amber-900">Son 1 saate kalan {closingSoon.length} sefer var.</div>
                    <ul className="mt-1 text-sm text-amber-900/90 list-disc ml-5">
                        {closingSoon.slice(0, 5).map(r => {
                            const m = minutesLeft(r.departure_time);
                            return (
                                <li key={r.id}>
                                    {r.trip || `${r.terminal_from} → ${r.terminal_to}`} • {fmtTR(r.departure_time)} •{' '}
                                    {Number.isFinite(m) ? `${m} dk kaldı` : '—'}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Sefer Ara</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        className="w-full sm:w-64 rounded-xl border px-3 py-2"
                        placeholder="Ara (şehir, firma...)"
                        value={q}
                        onChange={e => {
                            setPage(1);
                            setQ(e.target.value);
                        }}
                        aria-label="Arama"
                    />
                </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
                {pageRows.map(r => {
                    const m = minutesLeft(r.departure_time);
                    const closed = (Number.isFinite(m) && m <= 0) || isInactive(r);
                    const disable = closed || (Number.isFinite(m) && m <= 60);
                    return (
                        <div key={r.id} className={`rounded-2xl border bg-white p-4 ${disable ? 'opacity-75' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">{r.trip ?? '-'}</div>
                                <div className="flex items-center gap-2">
                                    <DisableBadge m={m as number} />
                                    <span className="text-xs px-2 py-1 rounded-lg border">{r.company_name ?? '-'}</span>
                                </div>
                            </div>
                            <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Güzergâh</div>
                                <div>
                                    {r.terminal_from} → {r.terminal_to}
                                </div>
                                <div className="text-indigo-900/60">Kalkış</div>
                                <div>{fmtTR(r.departure_time)}</div>
                                <div className="text-indigo-900/60">Ücret</div>
                                <div>{currency.format(Number(r.cost || 0))}</div>
                                <div className="text-indigo-900/60">Süre</div>
                                <div>{r.duration ?? '-'}</div>
                                <div className="text-indigo-900/60">Otobüs</div>
                                <div>{r.bus_type ?? '-'}</div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button
                                    className={`px-3 py-2 rounded-lg ${
                                        disable ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white'
                                    }`}
                                    disabled={disable}
                                    title={
                                        closed ? 'Satış kapalı' : Number.isFinite(m) && m <= 60 ? 'Son 1 saat. Satış durduruldu' : 'Satın al'
                                    }
                                    onClick={() => !disable && openDetail(r.id)}
                                    aria-label="Satın al"
                                >
                                    {closed ? 'Satış Kapalı' : Number.isFinite(m) && m <= 60 ? 'Kapanıyor' : 'Satın Al'}
                                </button>
                            </div>
                        </div>
                    );
                })}
                {!pageRows.length && (
                    <div className="rounded-xl border bg-white p-6 text-center text-indigo-900/50">
                        {loading ? 'Yükleniyor…' : 'Kayıt yok'}
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">Sefer</th>
                        <th>Firma</th>
                        <th>Güzergah</th>
                        <th>Kalkış</th>
                        <th>Ücret</th>
                        <th>Süre</th>
                        <th>Otobüs</th>
                        <th className="text-right">İşlem</th>
                    </tr>
                    </thead>
                    <tbody>
                    {pageRows.map(r => {
                        const m = minutesLeft(r.departure_time);
                        const closed = (Number.isFinite(m) && m <= 0) || isInactive(r);
                        const disable = closed || (Number.isFinite(m) && m <= 60);
                        return (
                            <tr key={r.id} className={`border-t ${disable ? 'opacity-70' : ''}`}>
                                <td className="py-2 font-medium flex items-center gap-2">
                                    {r.trip ?? '-'} <DisableBadge m={m as number} />
                                </td>
                                <td>{r.company_name ?? '-'}</td>
                                <td>
                                    {r.terminal_from} → {r.terminal_to}
                                </td>
                                <td>{fmtTR(r.departure_time)}</td>
                                <td>{currency.format(Number(r.cost || 0))}</td>
                                <td>{r.duration ?? '-'}</td>
                                <td>{r.bus_type ?? '-'}</td>
                                <td className="text-right">
                                    <button
                                        className={`px-3 py-2 rounded-lg border ${disable ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={disable}
                                        title={
                                            closed ? 'Satış kapalı' : Number.isFinite(m) && m <= 60 ? 'Son 1 saat. Satış durduruldu' : 'Satın al'
                                        }
                                        onClick={() => !disable && openDetail(r.id)}
                                        aria-label="Satın al"
                                    >
                                        {closed ? 'Satış Kapalı' : Number.isFinite(m) && m <= 60 ? 'Kapanıyor' : 'Satın Al'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {!pageRows.length && (
                        <tr>
                            <td colSpan={8} className="py-6 text-center text-indigo-900/50">
                                {loading ? 'Yükleniyor…' : 'Kayıt yok'}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mt-3">
                    <div className="text-sm text-indigo-900/60">
                        Toplam {filtered.length} kayıt • Sayfa {page}/{totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            aria-label="Geri"
                        >
                            Geri
                        </button>
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            aria-label="İleri"
                        >
                            İleri
                        </button>
                    </div>
                </div>
            </div>

            {open && detail && (
                <PurchaseModal
                    detail={detail}
                    onClose={() => {
                        setOpen(false);
                        setDetail(null);
                    }}
                    onPurchased={pnr => {
                        setOpen(false);
                        setDetail(null);
                        alert(`PNR: ${pnr}`);
                        router.push('/dashboard/passenger/orders');
                    }}
                />
            )}

            {loading && <div className="fixed inset-0 bg-black/20 grid place-items-center text-white">Yükleniyor…</div>}
        </div>
    );
}

/* ---------------- Purchase Modal (with seat holds) ---------------- */

type PassengerInfo = {
    seat?: string;
    first_name: string;
    last_name: string;
    doc_type: 'tc'|'passport';
    national_id: string;
    passport_no: string;
    nationality: string;
    email: string;
    phone: string;
};
const digits = (s:string)=> s.replace(/\D+/g,'');
const validExp = (v:string)=>/^\d{2}\/\d{2}$/.test(v);
const luhn = (num:string)=>{
    const s = digits(num);
    let sum=0,d=false;
    for(let i=s.length-1;i>=0;i--){ let n=+s[i]; if(d){n*=2;if(n>9)n-=9} sum+=n; d=!d; }
    return s.length>=12 && sum%10===0;
};
const validPassenger = (p: PassengerInfo) => {
    const nameOk = p.first_name.trim().length>1 && p.last_name.trim().length>1;
    const emailOk = !p.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email);
    const phoneOk = !p.phone || /^[0-9+\-\s]{7,}$/.test(p.phone);
    const idOk = p.doc_type==='tc' ? /^\d{11}$/.test(digits(p.national_id)) :
        (p.passport_no.trim().length>0 && p.nationality.trim().length>0);
    return nameOk && emailOk && phoneOk && idOk;
};

function PurchaseModal({
                           detail,
                           onClose,
                           onPurchased
                       }: {
    detail: TripDetail;
    onClose: () => void;
    onPurchased: (pnr: string) => void;
}) {
    const { token, isLoading } = (myAppHook() as any) || {};
    const layout = (detail.seat_map?.layout || detail.bus_type || '2+1') as '2+1' | '2+2';
    const rows = detail.seat_map?.rows ?? 12;

    const [qty, setQty] = useState(1);
    const [seats, setSeats] = useState<string[]>([]);
    const [passengers, setPassengers] = useState<PassengerInfo[]>([]);
    const [payment, setPayment] = useState({ card_holder: '', card_number: '', card_exp: '', card_cvv: '' });
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState<string>('');
    const [banner, setBanner] = useState<string>('');

    // disabledMap / taken
    const disabledMap = useMemo(() => {
        const arr: { code: string; type: 'fault' | 'blocked'; label?: string; reason?: string }[] =
            detail?.disabled_seats || [];
        const m = new Map<string, { label: string; type: 'fault' | 'blocked'; reason?: string }>();
        for (const o of arr) m.set(o.code, { label: o.label || (o.type === 'fault' ? 'Arıza' : 'Kapalı'), type: o.type, reason: o.reason });
        return m;
    }, [detail?.disabled_seats]);

    const taken = useMemo(() => {
        const codes =
            detail?.blocked_all && detail.blocked_all.length
                ? detail.blocked_all
                : [...(detail?.taken_seats || []), ...(detail?.disabled_seats || []).map(o => o.code)];
        return new Set(codes);
    }, [detail?.taken_seats, detail?.disabled_seats, detail?.blocked_all]);

    // reservation id
    const [reservationId] = useState<string>(() => {
        const rnd = (globalThis.crypto as any)?.randomUUID?.() ?? `res_${Math.random().toString(36).slice(2)}`;
        return rnd;
    });

    // qty / seats -> passengers sync
    useEffect(()=>{
        setPassengers(prev=>{
            const base = [...prev];
            while (base.length < qty) {
                base.push({
                    first_name:'', last_name:'', doc_type:'tc',
                    national_id:'', passport_no:'', nationality:'TR',
                    email:'', phone:'', seat: undefined
                });
            }
            return base.slice(0, qty);
        });
    },[qty]);
    useEffect(()=>{
        setPassengers(prev=> prev.map((p, i)=> ({...p, seat: seats[i]})));
    },[seats]);

    const price = useMemo(() => Number(detail.cost || 0) * seats.length, [detail.cost, seats.length]);

    const cardOk =
        payment.card_holder.trim().length>=2 &&
        luhn(payment.card_number) &&
        validExp(payment.card_exp) &&
        /^\d{3,4}$/.test(payment.card_cvv);

    const passengersOk = passengers.length===qty &&
        passengers.every((p, i)=> !!seats[i] && validPassenger(p));

    const minsLeft = useMemo(() => {
        const s = detail.departure_time.includes('T')
            ? detail.departure_time
            : detail.departure_time.replace(' ', 'T');
        return Math.floor((Date.parse(s) - Date.now()) / 60000);
    }, [detail.departure_time]);
    const blocked = Number.isFinite(minsLeft) && minsLeft <= 60;

    const toggleSeat = (s: string) => {
        if (taken.has(s)) return;
        setSeats(curr => {
            const has = curr.includes(s);
            let next = has ? curr.filter(x => x !== s) : [...curr, s];
            if (next.length > qty) next = next.slice(0, qty);
            return next;
        });
    };

    // HOLD API helpers
    const apiOpts = token ? { token } : undefined;
    const holdSeats = async (list: string[]) => {
        if (!list.length) return;
        try {
            await api.post('/seat-holds/hold', { reservation_id: reservationId, product_id: detail.id, seats: list }, apiOpts);
            setBanner('Koltuklar 5 dk rezerve edildi.');
            setErr('');
        } catch (e: any) {
            const p = e?.response?.data ?? e;
            const conflicts: string[] = p?.conflicts ?? [];
            setErr(p?.message || 'Koltuk rezerve edilemedi.');
            if (Array.isArray(conflicts) && conflicts.length) {
                setSeats(s => s.filter(x => !conflicts.includes(x)));
            }
        }
    };
    const extendHold = async () => { try { await api.post('/seat-holds/extend', { reservation_id: reservationId }, apiOpts); } catch {} };
    const releaseHold = async () => { try { await api.post('/seat-holds/release', { reservation_id: reservationId }, apiOpts); } catch {} };

    useEffect(() => {
        if (blocked) return;
        const t = setTimeout(() => {
            if (seats.length === qty && seats.length > 0) void holdSeats(seats);
            else if (seats.length === 0) void releaseHold();
        }, 350);
        return () => clearTimeout(t);
    }, [seats, qty, blocked]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (blocked || seats.length === 0) return;
        const iv = setInterval(() => { void extendHold(); }, 120_000);
        return () => clearInterval(iv);
    }, [seats.length, blocked]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { return () => { void releaseHold(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const unit_price = Number(detail.cost || 0);
    const total = unit_price * Number(qty || 1);
    const canSubmit = seats.length===qty && passengersOk && cardOk && !blocked;

    const submit = async () => {
        if (isLoading) return;
        if (!token) {
            try { await api.csrf(); } catch {}
        }
        if (!canSubmit) { setErr('Zorunlu alanları ve kart bilgilerini doğrulayın.'); return; }
        if (blocked) { setErr('Kalkışa 1 saatten az kaldı. Satış kapalı.'); return; }

        setSubmitting(true);
        setErr('');
        setBanner('');
        try {
            const payload = {
                product_id: detail.id,
                qty,
                seats,
                passengers: passengers.map((p,i)=>({
                    seat: seats[i],
                    first_name: p.first_name.trim(),
                    last_name: p.last_name.trim(),
                    doc_type: p.doc_type,
                    national_id: p.doc_type==='tc' ? digits(p.national_id) : null,
                    passport_no: p.doc_type==='passport' ? p.passport_no.trim() : null,
                    nationality: p.doc_type==='passport' ? p.nationality.trim() : 'TR',
                    email: p.email || null,
                    phone: p.phone || null,
                })),
                card_holder: payment.card_holder,
                card_number: payment.card_number,
                card_exp: payment.card_exp,
                card_cvv: payment.card_cvv,
            };
            const res = await api.post('/orders', payload, apiOpts);
            const data = await api.json<PurchaseResp>(res);
            if (data?.status) {
                setBanner('Satın alma başarılı.');
                onPurchased(data?.pnr || '');
                return;
            }
            setErr(data?.message || 'Satın alma başarısız.');
        } catch (e: any) {
            const p = e?.response?.data ?? e;
            setErr(p?.message || 'Satın alma hatası.');
        } finally {
            setSubmitting(false);
        }
    };

    const currency = useMemo(() => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }), []);

    return (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 grid place-items-center">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl border bg-white">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">
                            {detail.trip || `${detail.terminal_from} → ${detail.terminal_to}`}
                        </div>
                        <div className="text-xs text-indigo-900/60">
                            {detail.company_name || '-'} • Kalkış {fmtTR(detail.departure_time)} • {detail.duration || '—'} • {detail.bus_type || '—'}
                        </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg border" onClick={onClose} aria-label="Kapat">
                        Kapat
                    </button>
                </div>

                {banner && (
                    <div className="mx-4 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {banner}
                    </div>
                )}
                {err && (
                    <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">
                        {err}
                    </div>
                )}

                <div className="p-4 grid lg:grid-cols-[1.2fr_1fr] gap-4">
                    <div className="space-y-4">
                        {blocked && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                Kalkışa 1 saatten az kaldı. Satış kapalı.
                            </div>
                        )}
                        <section className="rounded-xl border p-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Koltuk Seçimi</h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm">Adet</label>
                                    <select
                                        className="rounded-lg border px-2 py-1"
                                        value={qty}
                                        onChange={e => {
                                            const n = Number(e.target.value);
                                            setQty(n);
                                            setSeats(s => s.slice(0, n));
                                        }}
                                        aria-label="Bilet adedi"
                                    >
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <SeatMap
                                rows={rows}
                                layout={layout}
                                taken={taken}
                                selected={seats}
                                onToggle={toggleSeat}
                                disabledMap={disabledMap}
                            />

                            <div className="mt-3 text-sm text-indigo-900/70">
                                Seçilen: {seats.length ? seats.join(', ') : '—'}
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Güzergâh Durakları</h3>
                            <div className="text-sm">
                                {(detail.route || []).length ? (
                                    <ul className="list-disc ml-5 space-y-1">
                                        {(detail.route || []).map((s, i) => (
                                            <li key={i}>{s.name}{s.time ? ` • ${s.time}` : ''}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-indigo-900/60">Bilgi yok</div>
                                )}
                            </div>
                        </section>

                        {(detail.important_notes || detail.cancellation_policy) && (
                            <section className="rounded-xl border p-3 text-sm">
                                {detail.important_notes && (<><div className="font-semibold mb-1">Önemli Notlar</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.important_notes}</div></>)}
                                {detail.cancellation_policy && (<><div className="font-semibold mt-2 mb-1">İptal/İade Koşulları</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.cancellation_policy}</div></>)}
                            </section>
                        )}
                    </div>

                    <div className="space-y-4">
                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Yolcular</h3>
                            <div className="space-y-2">
                                {passengers.map((p, idx)=>(
                                    <details key={idx} className="rounded-lg border">
                                        <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                      <span>
                        {idx+1}. Yolcu {p.first_name && p.last_name ? `• ${p.first_name} ${p.last_name}`:''}
                          {seats[idx] ? ` • Koltuk ${seats[idx]}` : ''}
                      </span>
                                            {!validPassenger(p) && <span className="text-xs text-red-600">Eksik</span>}
                                        </summary>
                                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <FormInput label="Ad" required value={p.first_name} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, first_name:v}:x))} />
                                            <FormInput label="Soyad" required value={p.last_name} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, last_name:v}:x))} />
                                            <FormInput label="E-posta" type="email" value={p.email} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, email:v}:x))} />
                                            <FormInput label="Telefon" type="tel" value={p.phone} onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, phone:v}:x))} />
                                            <div>
                                                <label className="block text-sm text-indigo-900/70 mb-1">Belge</label>
                                                <select
                                                    className="w-full rounded-lg border px-3 py-2"
                                                    value={p.doc_type}
                                                    onChange={e => setPassengers(a=>a.map((x,i)=> i===idx? {...x, doc_type: e.target.value as any }:x))}
                                                >
                                                    <option value="tc">TC Kimlik</option>
                                                    <option value="passport">Pasaport</option>
                                                </select>
                                            </div>
                                            {p.doc_type === 'tc' ? (
                                                <FormInput label="TC Kimlik No" required pattern="^\d{11}$" value={p.national_id}
                                                           onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, national_id:v}:x))}/>
                                            ) : (
                                                <>
                                                    <FormInput label="Pasaport No" required value={p.passport_no}
                                                               onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, passport_no:v}:x))}/>
                                                    <FormInput label="Uyruk" required value={p.nationality}
                                                               onChange={v=>setPassengers(a=>a.map((x,i)=> i===idx? {...x, nationality:v}:x))}/>
                                                </>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Ödeme Bilgileri</h3>
                            <FormInput label="Kart Üzerindeki İsim" required value={payment.card_holder}
                                       onChange={v => setPayment(s => ({ ...s, card_holder: v }))} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                <FormInput label="Kart Num." required inputMode="numeric" pattern="^[0-9\s]{12,19}$"
                                           value={payment.card_number}
                                           onChange={v => setPayment(s => ({ ...s, card_number: v }))} placeholder="**** **** **** ****" />
                                <FormInput label="SKT (AA/YY)" required pattern="^\d{2}\/\d{2}$"
                                           value={payment.card_exp}
                                           onChange={v => setPayment(s => ({ ...s, card_exp: v }))} placeholder="MM/YY" />
                                <FormInput label="CVV" required inputMode="numeric" pattern="^\d{3,4}$"
                                           value={payment.card_cvv}
                                           onChange={v => setPayment(s => ({ ...s, card_cvv: v }))} />
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Özet</h3>
                            <div className="text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Sefer</div>
                                <div>{detail.trip ?? '-'}</div>
                                <div className="text-indigo-900/60">Güzergâh</div>
                                <div>{detail.terminal_from} → {detail.terminal_to}</div>
                                <div className="text-indigo-900/60">Kalkış</div>
                                <div>{fmtTR(detail.departure_time)}</div>
                                <div className="text-indigo-900/60">Adet</div>
                                <div>{qty}</div>
                                <div className="text-indigo-900/60">Koltuk</div>
                                <div>{seats.length ? seats.join(', ') : '—'}</div>
                                <div className="text-indigo-900/60">Tutar</div>
                                <div className="font-semibold">{currency.format(price)}</div>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <button
                                    className="px-4 py-2 rounded-xl border"
                                    onClick={async () => {
                                        try { await api.post('/seat-holds/release', { reservation_id: reservationId }, token ? { token } : undefined); } catch {}
                                        onClose();
                                    }}
                                >
                                    Vazgeç
                                </button>
                                <button
                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                                    disabled={!canSubmit || submitting || blocked}
                                    onClick={submit}
                                    aria-label="Satın al"
                                >
                                    {submitting ? 'Gönderiliyor…' : blocked ? 'Satış Kapalı' : 'Satın Al'}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------- Inputs and SeatMap ---------- */

function FormInput({
                       label, value, onChange, placeholder = '', required = false,
                       type = 'text', inputMode, pattern
                   }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    type?: React.HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    pattern?: string;
}) {
    return (
        <div>
            <label className="block text-sm text-indigo-900/70 mb-1">
                {label}{required && (<span aria-hidden="true" className="text-red-600"> *</span>)}
            </label>
            <input
                className="w-full rounded-lg border px-3 py-2"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                type={type}
                inputMode={inputMode}
                pattern={pattern}
                aria-required={required}
            />
        </div>
    );
}

function SeatMap({
                     rows, layout, taken, selected, onToggle,
                     disabledMap
                 }: {
    rows: number;
    layout: '2+1' | '2+2';
    taken: Set<string>;
    selected: string[];
    onToggle: (s: string) => void;
    disabledMap: Map<string, { label: string; type: 'fault' | 'blocked'; reason?: string }>;
}) {
    const left = ['A', 'B'];
    const right = layout === '2+1' ? ['C'] : ['C', 'D'];

    const btnCls = (code: string) => {
        const tk = taken.has(code);
        const sel = selected.includes(code);
        if (tk) return 'bg-gray-200 text-gray-500 cursor-not-allowed relative';
        return sel ? 'bg-indigo-600 text-white relative' : 'bg-white hover:bg-gray-50 relative';
    };

    const Ribbon = ({ code }: { code: string }) => {
        const meta = disabledMap.get(code);
        if (!meta) return null;
        return (
            <span
                className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded text-[10px] border"
                title={`${meta.label}${meta.reason ? `: ${meta.reason}` : ''}`}
            >
        {meta.label}
      </span>
        );
    };

    return (
        <div className="border rounded-xl p-3" aria-label="Koltuk planı">
            <div className="mb-2 text-xs text-indigo-900/60">
                Düzen: {layout} • Sıra: {rows}
            </div>
            <div className="space-y-1">
                {Array.from({ length: rows }).map((_, i) => {
                    const r = i + 1;
                    return (
                        <div key={r} className="flex items-center gap-2">
                            <div className="flex gap-1">
                                {left.map(c => {
                                    const code = `${r}${c}`;
                                    const dis = taken.has(code);
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            className={`w-10 h-10 rounded-lg border text-xs font-medium ${btnCls(code)}`}
                                            disabled={dis}
                                            onClick={() => onToggle(code)}
                                            title={disabledMap.get(code)?.label ? `${code} (${disabledMap.get(code)?.label})` : code}
                                            aria-label={`Koltuk ${code}${dis ? ' (Pasif)' : selected.includes(code) ? ' (Seçili)' : ''}`}
                                        >
                                            {code}
                                            <Ribbon code={code} />
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="w-6" />
                            <div className="flex gap-1">
                                {right.map(c => {
                                    const code = `${r}${c}`;
                                    const dis = taken.has(code);
                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            className={`w-10 h-10 rounded-lg border text-xs font-medium ${btnCls(code)}`}
                                            disabled={dis}
                                            onClick={() => onToggle(code)}
                                            title={disabledMap.get(code)?.label ? `${code} (${disabledMap.get(code)?.label})` : code}
                                            aria-label={`Koltuk ${code}${dis ? ' (Pasif)' : selected.includes(code) ? ' (Seçili)' : ''}`}
                                        >
                                            {code}
                                            <Ribbon code={code} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-indigo-900/60">Dolu, arızalı ve kapalı koltuklar seçilemez.</div>
        </div>
    );
}
