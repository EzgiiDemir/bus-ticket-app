'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';
import { listTrips } from '../../../../lib/adminApi';
import { fmtTR } from '../../../../lib/datetime';
import { exportCSV } from '@/app/lib/export';

type Trip = {
    id:number;
    trip?:string;
    company_name?:string;
    company?:{ name?:string };
    terminal_from:string;
    terminal_to:string;
    departure_time:string;
    cost:number|string;
    capacity_reservation:number;
    is_active:boolean|number;
    orders?:number|string;
    seats?:number|string;
    revenue?:number|string;
};

type Page<T> = {
    data:T[];
    current_page?:number; last_page?:number; per_page?:number; total?:number;
    next_page_url?:string|null; prev_page_url?:string|null;
};

type Buyer = {
    id:number;
    pnr?:string;
    qty?:number;
    total?:number|string;
    created_at?:string;
    passenger_name?:string;
    seat_numbers?:string[]|string;
    user?:{ name?:string; email?:string };
};

type Personnel = {
    id:number;
    name?:string;
    email?:string;
    phone?:string|null;
    role?:string;
    company?:{ name?:string };
    created_at?:string;
};

export default function AdminTrips(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10);
    const [loading,setLoading]=useState(false);
    const [modalTrip,setModalTrip] = useState<Trip|null>(null);

    const toNum=(v:any)=>Number((typeof v==='string'?v.replace(',','.') : v) || 0);
    const fmtTL=(v:any)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(toNum(v));

    useEffect(()=>{
        if(isLoading||!token||user?.role!=='admin') return;
        setLoading(true);
        listTrips({ q })
            .then((d:any)=> setRows(Array.isArray(d)? d : (d?.data||[])))
            .finally(()=> setLoading(false));
    },[isLoading,token,user,q]);

    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase();
        if(!t) return rows;
        return rows.filter(r =>
            [
                r.trip, r.company_name, r.company?.name,
                r.terminal_from, r.terminal_to, r.departure_time
            ].some(x=> String(x||'').toLowerCase().includes(t))
        );
    },[rows,q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages, page]);

    const paged = useMemo(()=>{
        const start = (page-1)*pageSize;
        return filtered.slice(start, start+pageSize);
    },[filtered, page, pageSize]);

    if (isLoading) return <div className="p-4">Yükleniyor…</div>;
    if (!token) return <div className="p-4">Giriş yapın.</div>;
    if (user?.role!=='admin') return <div className="p-4">Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-indigo-900/80">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <div className="grid grid-cols-1 sm:auto-cols-max sm:grid-flow-col gap-2">
                    <input
                        className="w-full sm:w-64 rounded-xl border px-3 py-2"
                        placeholder="Ara (sefer, firma, güzergâh)…"
                        value={q}
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
                        aria-label="Sefer ara"
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={pageSize}
                        onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                        aria-label="Sayfa başına"
                    >
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button
                        className="rounded-xl border px-3 py-2"
                        onClick={()=>{
                            exportCSV('seferler_tumu', filtered, [
                                { key:'trip', title:'Sefer' },
                                { key:'company_name', title:'Firma', map:(r:Trip)=> r.company_name || r.company?.name || '' },
                                { key:'route', title:'Güzergah', map:(r:Trip)=> `${r.terminal_from} → ${r.terminal_to}` },
                                { key:'departure_time', title:'Kalkış' },
                                { key:'cost', title:'Ücret', map:(r:Trip)=> toNum(r.cost) },
                                { key:'capacity_reservation', title:'Kapasite' },
                                { key:'is_active', title:'Aktif', map:(r:Trip)=> (r.is_active ? 'Evet':'Hayır') },
                                { key:'orders', title:'Sipariş', map:(r:Trip)=> toNum(r.orders) },
                                { key:'seats', title:'Koltuk', map:(r:Trip)=> toNum(r.seats) },
                                { key:'revenue', title:'Gelir', map:(r:Trip)=> toNum(r.revenue) },
                            ]);
                        }}
                    >CSV</button>
                </div>
            </div>

            {/* Summary + Pagination row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-indigo-900/60">
                <div>Görüntülenen: <b>{total ? ((page-1)*pageSize+1) : 0}–{Math.min(page*pageSize, total)}</b> / {total}</div>
                <div className="flex items-center gap-2">
                    <button
                        className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        disabled={page<=1}
                        onClick={()=>setPage(p=>Math.max(1,p-1))}
                    >Önceki</button>
                    <span className="text-indigo-900">{page} / {totalPages}</span>
                    <button
                        className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        disabled={page>=totalPages}
                        onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                    >Sonraki</button>
                </div>
            </div>

            {/* Mobile list (cards) */}
            <div className="grid gap-3 sm:hidden">
                {paged.map(t=>(
                    <div key={t.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-indigo-900">{t.trip || '-'}</div>
                                <div className="text-xs text-indigo-900/60">{t.company_name || t.company?.name || '-'}</div>
                            </div>
                            <button className="px-3 py-1 rounded-lg border" onClick={()=>setModalTrip(t)}>Detay</button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                            <div className="text-indigo-900/60">Güzergâh</div><div>{t.terminal_from} → {t.terminal_to}</div>
                            <div className="text-indigo-900/60">Kalkış</div><div>{fmtTR(t.departure_time)}</div>
                            <div className="text-indigo-900/60">Ücret</div><div>{fmtTL(t.cost)}</div>
                            <div className="text-indigo-900/60">Kapasite</div><div>{t.capacity_reservation}</div>
                            <div className="text-indigo-900/60">Aktif</div><div>{t.is_active ? 'Evet':'Hayır'}</div>
                            <div className="text-indigo-900/60">Sipariş</div><div>{toNum(t.orders)}</div>
                            <div className="text-indigo-900/60">Koltuk</div><div>{toNum(t.seats)}</div>
                            <div className="text-indigo-900/60">Gelir</div><div>{fmtTL(t.revenue)}</div>
                        </div>
                    </div>
                ))}
                {!paged.length && !loading && (
                    <div className="rounded-xl border bg-white p-6 text-center text-indigo-900/50">Kayıt yok</div>
                )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">Sefer</th>
                        <th>Firma</th>
                        <th>Güzergah</th>
                        <th>Kalkış</th>
                        <th>Ücret</th>
                        <th>Kapasite</th>
                        <th>Aktif</th>
                        <th>Sipariş</th>
                        <th>Koltuk</th>
                        <th>Gelir</th>
                        <th className="text-right">İşlemler</th>
                    </tr>
                    </thead>
                    <tbody>
                    {paged.map(t=>(
                        <tr key={t.id} className="border-t">
                            <td className="py-2">{t.trip}</td>
                            <td>{t.company_name || t.company?.name || '-'}</td>
                            <td>{t.terminal_from} → {t.terminal_to}</td>
                            <td>{fmtTR(t.departure_time)}</td>
                            <td>{fmtTL(t.cost)}</td>
                            <td>{t.capacity_reservation}</td>
                            <td>{t.is_active ? 'Evet' : 'Hayır'}</td>
                            <td>{toNum(t.orders)}</td>
                            <td>{toNum(t.seats)}</td>
                            <td>{fmtTL(t.revenue)}</td>
                            <td className="text-right">
                                <button className="px-3 py-1 rounded-lg border" onClick={()=>setModalTrip(t)}>Detay</button>
                            </td>
                        </tr>
                    ))}
                    {!paged.length && !loading && (
                        <tr><td colSpan={11} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {modalTrip && (
                <TripActionsModal
                    trip={modalTrip}
                    token={token}
                    onClose={()=>setModalTrip(null)}
                />
            )}
        </div>
    );
}

/* ---------------- Modal: İşlemler (Müşteriler + Personel) ---------------- */

function TripActionsModal({
                              trip, token, onClose
                          }:{ trip:Trip; token:string; onClose:()=>void }){
    const [creator,setCreator] = useState<Personnel|null>(null);
    const [creatorErr,setCreatorErr] = useState('');
    const [buyers,setBuyers] = useState<Page<Buyer>|null>(null);
    const [bPer,setBPer] = useState(10);
    const [loading,setLoading] = useState(false);
    const [buyersErr,setBuyersErr] = useState('');

    const authHeader = { Authorization: `Bearer ${token}` };

    const loadCreator = async ()=>{
        setCreatorErr('');
        try{
            const { data } = await axios.get<Personnel>(`/admin/trips/${trip.id}/creator`, { headers: authHeader });
            setCreator(data);
        }catch(e:any){
            setCreatorErr(e?.response?.data?.message || 'Personel bilgisi alınamadı');
        }
    };

    const loadBuyers = async (p:number)=>{
        setLoading(true);
        setBuyersErr('');
        try{
            const { data } = await axios.get<Page<Buyer>>(`/admin/trips/${trip.id}/buyers`, {
                headers: authHeader,
                params: { page: p, per_page: bPer },
            });
            setBuyers(data);
        }catch(e:any){
            setBuyersErr(e?.response?.data?.message || 'Satın alanlar alınamadı');
        }finally{ setLoading(false); }
    };

    useEffect(()=>{ loadCreator(); loadBuyers(1); /* eslint-disable-next-line */ }, [trip.id, bPer]);

    const bLast =
        buyers?.last_page
        ?? (buyers?.total && buyers?.per_page
            ? Math.max(1, Math.ceil((buyers.total as number)/(buyers.per_page as number)))
            : 1);

    const fmtTL=(v:any)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(v||0));

    return (
        <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6 grid place-items-center">
            <div className="w-full max-w-6xl max-h-[95vh] overflow-y-auto rounded-2xl border bg-white">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b p-3 sm:p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="text-base sm:text-lg font-semibold text-indigo-900">
                                {trip.trip || `${trip.terminal_from} → ${trip.terminal_to}`}
                            </div>
                            <div className="text-xs text-indigo-900/60">
                                {trip.company_name || trip.company?.name || '-'} • Kalkış {fmtTR(trip.departure_time)} • Ücret {fmtTL(trip.cost)}
                            </div>
                        </div>
                        <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Kapat</button>
                    </div>
                </div>

                <div className="p-3 sm:p-4  gap-4 lg:grid-cols-[1fr_1.6fr]">
                    <section className="rounded-xl border p-3 sm:p-4">
                        <h3 className="font-semibold text-indigo-900 mb-2">Seferi Oluşturan Personel</h3>
                        {creatorErr && <div className="text-sm text-red-600">{creatorErr}</div>}
                        {!creator && !creatorErr && <div className="text-sm text-indigo-900/60">Yükleniyor…</div>}
                        {creator && (
                            <>
                                {/* Mobile stacked */}
                                <div className="sm:hidden text-sm grid grid-cols-2 gap-y-1">
                                    <div className="text-indigo-900/60">Ad Soyad</div><div>{creator.name || '-'}</div>
                                    <div className="text-indigo-900/60">E-posta</div><div>{creator.email || '-'}</div>
                                    <div className="text-indigo-900/60">Telefon</div><div>{creator.phone || '-'}</div>
                                    <div className="text-indigo-900/60">Rol</div><div>{creator.role || 'personnel'}</div>
                                    <div className="text-indigo-900/60">Firma</div><div>{creator.company?.name || '-'}</div>
                                    <div className="text-indigo-900/60">Oluşturma</div><div>{fmtTR(creator.created_at)}</div>
                                </div>
                                {/* Desktop table-like */}
                                <div className="hidden sm:block">
                                    <div className="grid grid-cols-4 gap-3 text-sm">
                                        <div><div className="text-indigo-900/60">Ad Soyad</div><div>{creator.name || '-'}</div></div>
                                        <div><div className="text-indigo-900/60">E-posta</div><div>{creator.email || '-'}</div></div>
                                        <div><div className="text-indigo-900/60">Telefon</div><div>{creator.phone || '-'}</div></div>
                                        <div><div className="text-indigo-900/60">Rol</div><div>{creator.role || 'personnel'}</div></div>
                                        <div><div className="text-indigo-900/60">Firma</div><div>{creator.company?.name || '-'}</div></div>
                                        <div><div className="text-indigo-900/60">Oluşturma</div><div>{fmtTR(creator.created_at)}</div></div>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    {/* Satın alanlar */}
                    <section className="rounded-xl border p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <h3 className="font-semibold text-indigo-900">Satın Alan Müşteriler</h3>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-indigo-900/70">Sayfa:</label>
                                <select
                                    className="rounded-lg border px-2 py-1"
                                    value={bPer}
                                    onChange={e=>{ setBPer(Number(e.target.value)); }}
                                >
                                    {[10,20,50].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                                </select>
                                <button
                                    className="px-3 py-1 rounded-lg border"
                                    onClick={()=> exportCSV(`trip_${trip.id}_buyers`, (buyers?.data||[]), [
                                        { key:'pnr', title:'PNR' },
                                        { key:'passenger_name', title:'Yolcu' },
                                        { key:'qty', title:'Adet' },
                                        { key:'total', title:'Tutar' },
                                        { key:'seats', title:'Koltuk', map:(b:Buyer)=> Array.isArray(b.seat_numbers)? b.seat_numbers.join(', ') : (b.seat_numbers||'') },
                                        { key:'created_at', title:'Tarih' },
                                        { key:'email', title:'E-posta', map:(b:Buyer)=> b.user?.email || '' },
                                    ])}
                                >CSV</button>
                            </div>
                        </div>

                        {buyersErr && <div className="text-sm text-red-600 mb-2">{buyersErr}</div>}

                        {/* Mobile cards */}
                        <div className="grid gap-2 sm:hidden">
                            {(buyers?.data||[]).map(b=>(
                                <div key={b.id} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="font-mono text-sm">{b.pnr || '-'}</div>
                                        <div className="text-xs text-indigo-900/60">{fmtTR(b.created_at||'')}</div>
                                    </div>
                                    <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                                        <div className="text-indigo-900/60">Yolcu</div><div>{b.passenger_name || b.user?.name || '-'}</div>
                                        <div className="text-indigo-900/60">Koltuk</div><div>{Array.isArray(b.seat_numbers)? b.seat_numbers.join(', ') : (b.seat_numbers || '-')}</div>
                                        <div className="text-indigo-900/60">Adet</div><div>{b.qty ?? '-'}</div>
                                        <div className="text-indigo-900/60">Tutar</div><div>{fmtTL(b.total)}</div>
                                        <div className="text-indigo-900/60">E-posta</div><div className="truncate">{b.user?.email || '-'}</div>
                                    </div>
                                </div>
                            ))}
                            {(!buyers?.data?.length && !buyersErr) && (
                                <div className="rounded-lg border p-4 text-center text-indigo-900/50">
                                    {loading? 'Yükleniyor…' : 'Kayıt yok'}
                                </div>
                            )}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto rounded-lg border">
                            <table className="min-w-[900px] w-full text-sm">
                                <thead>
                                <tr className="text-left text-indigo-900/60">
                                    <th className="py-2 px-2">PNR</th>
                                    <th className="px-2">Yolcu</th>
                                    <th className="px-2">Koltuk</th>
                                    <th className="px-2">Adet</th>
                                    <th className="px-2">Tutar</th>
                                    <th className="px-2">E-posta</th>
                                    <th className="px-2">Tarih</th>
                                </tr>
                                </thead>
                                <tbody>
                                {(buyers?.data||[]).map(b=>(
                                    <tr key={b.id} className="border-t">
                                        <td className="py-2 px-2 font-mono">{b.pnr || '-'}</td>
                                        <td className="px-2">{b.passenger_name || b.user?.name || '-'}</td>
                                        <td className="px-2">
                                            {Array.isArray(b.seat_numbers) ? b.seat_numbers.join(', ')
                                                : (typeof b.seat_numbers==='string'? b.seat_numbers : '-')}
                                        </td>
                                        <td className="px-2">{b.qty ?? '-'}</td>
                                        <td className="px-2">{fmtTL(b.total)}</td>
                                        <td className="px-2">{b.user?.email || '-'}</td>
                                        <td className="px-2">{fmtTR(b.created_at||'')}</td>
                                    </tr>
                                ))}
                                {(!buyers?.data?.length && !buyersErr) && (
                                    <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">{loading? 'Yükleniyor…' : 'Kayıt yok'}</td></tr>
                                )}
                                </tbody>
                            </table>
                        </div>

                        {/* İç modal pagination */}
                        <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
                            <div className="text-indigo-900/60">
                                Toplam {buyers?.total ?? buyers?.data?.length ?? 0} kayıt
                                {buyers?.current_page && buyers?.last_page ? ` • Sayfa ${buyers.current_page}/${buyers.last_page}` : ''}
                            </div>
                            <div className="flex items-center  gap-2">
                                <button
                                    className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                    disabled={loading || (buyers?.current_page ?? 1) <= 1}
                                    onClick={()=> loadBuyers(Math.max(1, (buyers?.current_page ?? 1) - 1))}
                                >Önceki</button>
                                <button
                                    className="px-3 py-1 rounded-lg border disabled:opacity-50"
                                    disabled={loading || (buyers?.current_page ?? 1) >= (bLast || 1)}
                                    onClick={()=> loadBuyers((buyers?.current_page ?? 1) + 1)}
                                >Sonraki</button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
