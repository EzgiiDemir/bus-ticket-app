'use client';
import { useEffect, useMemo, useState } from 'react';
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

export default function AdminTrips(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10);
    const [loading,setLoading]=useState(false);

    const toNum=(v:any)=>Number((typeof v==='string'?v.replace(',','.') : v) || 0);
    const fmtTL=(v:any)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(toNum(v));

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
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

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

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
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
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

            {/* Table */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? ((page-1)*pageSize+1) : 0}–{Math.min(page*pageSize, total)}</b> / {total} •
                    &nbsp;Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
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
                            </tr>
                        ))}
                        {!paged.length && !loading && (
                            <tr><td colSpan={10} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> sefer</div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page<=1}
                            onClick={()=>setPage(p=>Math.max(1,p-1))}
                        >Önceki</button>
                        <span className="text-sm">{page} / {totalPages}</span>
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page>=totalPages}
                            onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                        >Sonraki</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
