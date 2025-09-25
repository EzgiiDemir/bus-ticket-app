'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type Trip = {
    id:number;
    trip?: string;
    company_name?: string;
    terminal_from:string;
    terminal_to:string;
    departure_time:string;
    cost:number|string;
    capacity_reservation:number;
    is_active:number|boolean;
    note?:string;
    duration?:string;
    bus_type?:string;
    route?: { name:string; time?:string }[];
    created_at?:string;
};
type Passenger = {
    id:number;
    passenger_name:string;
    passenger_email?:string;
    passenger_phone?:string;
    qty:number;
    seats?:string[];
    pnr:string;
    created_at:string;
};
type PageResp<T> = {
    data:T[];
    total?:number;
    current_page?:number;
    last_page?:number;
    next_page_url?:string|null;
    prev_page_url?:string|null;
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ---------- Yardımcılar ---------- */
const toISO = (s?:string) => s ? (s.includes('T') ? s : s.replace(' ','T')) : '';
const fmtTR = (iso?:string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const fmtTL = (n:any) =>
    new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number((typeof n==='string'?n.replace(',','.') : n) || 0));

/* ---------- Sayfa ---------- */
export default function HistoryPage(){
    const { token, isLoading, user } = (myAppHook() as any) || {};

    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [tab,setTab]=useState<'all'|'past'|'upcoming'>('all');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // modal
    const [showPassengers,setShowPassengers]=useState<Trip|null>(null);
    const [passengers,setPassengers]=useState<Passenger[]>([]);
    const [pPage,setPPage]=useState(1);
    const [pPerPage,setPPerPage]=useState(10);
    const [pTotal,setPTotal]=useState(0);

    // ui state
    const [loading,setLoading]=useState(true);
    const [err,setErr]=useState('');
    const [banner,setBanner]=useState('');

    const refresh = useCallback(async ()=>{
        if(!token) { setLoading(false); return; }
        setLoading(true); setErr(''); setBanner('');
        try{
            const { data } = await axios.get<{products:Trip[]}|Trip[]>('/products', { headers:{ Accept:'application/json' } });
            const list = Array.isArray(data) ? data : (data?.products ?? []);
            setRows(list);
            setBanner(`Toplam ${list.length} sefer yüklendi.`);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Seferler alınamadı.');
            setRows([]);
        }finally{
            setLoading(false);
        }
    },[token]);

    useEffect(()=>{ if(!isLoading) void refresh(); },[isLoading, refresh]);

    // filtreleme
    const nowISO = useMemo(()=> new Date().toISOString(), []);
    const filtered = useMemo(()=>{
        let arr = rows;
        if (tab==='past')     arr = rows.filter(r => toISO(r.departure_time) <  nowISO);
        if (tab==='upcoming') arr = rows.filter(r => toISO(r.departure_time) >= nowISO);
        const s = q.trim().toLowerCase();
        return s ? arr.filter(r => JSON.stringify(r).toLowerCase().includes(s)) : arr;
    },[rows, tab, q, nowISO]);

    // sayfalama (liste)
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page>totalPages) setPage(Math.max(1,totalPages)); },[totalPages,page]);
    const paged = useMemo(()=>{
        const start = (page-1)*pageSize;
        return filtered.slice(start, start+pageSize);
    },[filtered,page,pageSize]);

    // yolcular modal
    const openPassengers = useCallback(async (trip:Trip, toPage=1) => {
        try{
            const { data } = await axios.get<PageResp<Passenger>>(`/products/${trip.id}/orders`, {
                params:{ per_page:pPerPage, page:toPage },
                headers:{ Accept:'application/json' }
            });
            const list = Array.isArray((data as any)?.data) ? (data as any).data : (Array.isArray(data) ? (data as any as Passenger[]) : []);
            setPassengers(list);
            setPTotal(Number((data as any)?.total ?? list.length));
            setPPage(Number((data as any)?.current_page ?? toPage));
            setShowPassengers(trip);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            alert(p?.message || 'Yolcular alınamadı');
        }
    },[pPerPage]);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    return (
        <div className="space-y-4 text-indigo-900/80">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-indigo-900">Geçmiş Seferler</h1>
                <div className="flex items-center gap-2">
                    <input
                        className="rounded-xl border px-3 py-2"
                        placeholder="Ara..."
                        value={q}
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
                        aria-label="Sefer ara"
                    />
                    <div className="flex rounded-xl border overflow-hidden" role="tablist" aria-label="Filtre">
                        {(['all','past','upcoming'] as const).map(t=>(
                            <button key={t}
                                    onClick={()=>{ setTab(t); setPage(1); }}
                                    className={`px-3 py-2 text-sm ${tab===t?'bg-indigo-600 text-white':'bg-white'}`}
                                    role="tab" aria-selected={tab===t}
                            >
                                {t==='all'?'Tümü':t==='past'?'Geçmiş':'Yaklaşan'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            {/* Desktop */}
            <div className="hidden md:block rounded-2xl border bg-white p-4">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">Sefer</th>
                        <th>Firma</th>
                        <th>Güzergâh</th>
                        <th>Kalkış</th>
                        <th>Oluşturulma</th>
                        <th>Ücret</th>
                        <th>Kapasite</th>
                        <th className="text-right">İşlem</th>
                    </tr>
                    </thead>
                    <tbody>
                    {paged.map(r=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2 font-medium">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</td>
                            <td>{r.company_name || '-'}</td>
                            <td>{r.terminal_from} → {r.terminal_to}</td>
                            <td>{fmtTR(r.departure_time)}</td>
                            <td>{fmtTR(r.created_at)}</td>
                            <td>{fmtTL(r.cost)}</td>
                            <td>{r.capacity_reservation}</td>
                            <td className="text-right">
                                <button className="px-2 py-1 rounded-lg border"
                                        onClick={()=>openPassengers(r,1)}>
                                    Yolcuları Gör
                                </button>
                            </td>
                        </tr>
                    ))}
                    {paged.length===0 && (
                        <tr><td colSpan={8} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
                {paged.map(r=>(
                    <div key={r.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold">{r.trip || `${r.terminal_from} - ${r.terminal_to}`}</div>
                            <span className="text-xs px-2 py-1 rounded-lg border">{r.company_name || '-'}</span>
                        </div>
                        <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                            <div className="text-indigo-900/60">Güzergâh</div><div>{r.terminal_from} → {r.terminal_to}</div>
                            <div className="text-indigo-900/60">Kalkış</div><div>{fmtTR(r.departure_time)}</div>
                            <div className="text-indigo-900/60">Oluşturulma</div><div>{fmtTR(r.created_at)}</div>
                            <div className="text-indigo-900/60">Ücret</div><div>{fmtTL(r.cost)}</div>
                            <div className="text-indigo-900/60">Kapasite</div><div>{r.capacity_reservation}</div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button className="px-3 py-1 rounded-lg border" onClick={()=>openPassengers(r,1)}>Yolcuları Gör</button>
                        </div>
                    </div>
                ))}
                {paged.length===0 && (
                    <div className="rounded-2xl border bg-white p-6 text-center text-indigo-900/50">Kayıt yok</div>
                )}
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-indigo-900/60">Toplam <b>{total}</b> kayıt • Sayfa {page}/{totalPages}</div>
                <div className="flex items-center gap-2">
                    <select className="rounded-xl border px-2 py-1" value={pageSize} onChange={e=>{ setPageSize(+e.target.value); setPage(1); }} aria-label="Sayfa başına">
                        {[5,10,20,50].map(s=><option key={s} value={s}>{s}/sayfa</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Önceki</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Sonraki</button>
                    </div>
                </div>
            </div>

            {showPassengers && (
                <PassengerModal
                    trip={showPassengers}
                    passengers={passengers}
                    page={pPage}
                    perPage={pPerPage}
                    total={pTotal}
                    onChangePage={(np)=>openPassengers(showPassengers, np)}
                    onChangePerPage={(n)=>{ setPPerPage(n); openPassengers(showPassengers,1); }}
                    onClose={()=>{ setShowPassengers(null); setPassengers([]); }}
                />
            )}
        </div>
    );
}

/* ---------- Modal ---------- */
function PassengerModal({
                            trip, passengers, page, perPage, total, onChangePage, onChangePerPage, onClose
                        }:{
    trip:Trip;
    passengers:Passenger[];
    page:number;
    perPage:number;
    total:number;
    onChangePage:(p:number)=>void;
    onChangePerPage:(n:number)=>void;
    onClose:()=>void;
}){
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">Yolcular • {trip.trip || `${trip.terminal_from} → ${trip.terminal_to}`}</h2>
                    <button onClick={onClose} className="px-2 py-1 rounded-lg border">Kapat</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[800px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad Soyad</th>
                            <th>E-posta</th>
                            <th>Telefon</th>
                            <th>PNR</th>
                            <th>Koltuk</th>
                            <th>Adet</th>
                            <th>Satın Alma</th>
                        </tr>
                        </thead>
                        <tbody>
                        {passengers.map(p=>(
                            <tr key={p.id} className="border-t">
                                <td className="py-2">{p.passenger_name}</td>
                                <td>{p.passenger_email||'-'}</td>
                                <td>{p.passenger_phone||'-'}</td>
                                <td className="font-mono">{p.pnr}</td>
                                <td>{(p.seats||[]).join(', ') || '-'}</td>
                                <td>{p.qty}</td>
                                <td>{fmtTR(p.created_at)}</td>
                            </tr>
                        ))}
                        {passengers.length===0 && (
                            <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Yolcu yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-indigo-900/60">Toplam <b>{total}</b> kayıt • Sayfa {page}/{totalPages}</div>
                    <div className="flex items-center gap-2">
                        <select className="rounded-xl border px-2 py-1" value={perPage} onChange={e=>onChangePerPage(+e.target.value)} aria-label="Sayfa başına">
                            {[5,10,20,50].map(s=><option key={s} value={s}>{s}/sayfa</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                            <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page<=1} onClick={()=>onChangePage(page-1)}>Önceki</button>
                            <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page>=totalPages} onClick={()=>onChangePage(page+1)}>Sonraki</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
