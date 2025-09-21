'use client';
import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listPersonnel } from '../../../../lib/adminApi';
import { exportCSV } from '@/app/lib/export';

type Row = {
    id:number;
    name:string;
    email:string;
    company?: { name?:string };
    role_status?:string;
    trips?:number;
    seats?:number;
    revenue?:number|string;
};

export default function AdminPersonnel(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<Row[]>([]);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10);
    const [loading,setLoading]=useState(false);

    const trCur=(v:any)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY', maximumFractionDigits:2})
        .format(Number((typeof v==='string'?v.replace(',','.') : v) || 0));

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
        setLoading(true);
        listPersonnel({ q })
            .then((d:any)=> setRows(Array.isArray(d)? d: (d?.data||[])))
            .finally(()=> setLoading(false));
    },[isLoading,token,user,q]);

    // İsteğe ek yerel filtre (gerekliyse)
    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase();
        if(!t) return rows;
        return rows.filter(r =>
            [r.name, r.email, r.company?.name, r.role_status].some(x=> String(x||'').toLowerCase().includes(t))
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
            {/* Üst çubuk */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Personel</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (ad, e-posta, firma)…"
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
                            exportCSV('personel_tumu', filtered, [
                                { key:'name', title:'Ad' },
                                { key:'email', title:'E-posta' },
                                { key:'company', title:'Firma', map:(r:Row)=> r.company?.name || '-' },
                                { key:'role_status', title:'Durum' },
                                { key:'trips', title:'Sefer' },
                                { key:'seats', title:'Koltuk' },
                                { key:'revenue', title:'Gelir', map:(r:Row)=> Number(r.revenue||0) },
                            ]);
                        }}
                    >CSV</button>
                </div>
            </div>

            {/* Tablo */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? ( (page-1)*pageSize+1 ) : 0}–{Math.min(page*pageSize, total)}</b> / {total} •
                    &nbsp;Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad</th>
                            <th>E-posta</th>
                            <th>Firma</th>
                            <th>Durum</th>
                            <th>Sefer</th>
                            <th>Koltuk</th>
                            <th>Gelir</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paged.map(p=>(
                            <tr key={p.id} className="border-t">
                                <td className="py-2">{p.name}</td>
                                <td>{p.email}</td>
                                <td>{p.company?.name ?? '-'}</td>
                                <td>{p.role_status ?? '-'}</td>
                                <td>{p.trips ?? 0}</td>
                                <td>{p.seats ?? 0}</td>
                                <td>{trCur(p.revenue)}</td>
                            </tr>
                        ))}
                        {!paged.length && !loading && (
                            <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">
                        Toplam <b>{total}</b> kayıt
                    </div>
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
