'use client';
import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listCompanies } from '../../../../lib/adminApi';

type Co = {
    id:number;
    name:string;
    code:string;
    trips?:number;
    personnel?:number;
    revenue?:number|string;
};

export default function AdminCompanies(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<Co[]>([]);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10);
    const [loading,setLoading]=useState(false);

    const toNum=(v:any)=>Number((typeof v==='string'?v.replace(',','.') : v) || 0);
    const fmtTL=(v:any)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(toNum(v));

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
        setLoading(true);
        listCompanies()
            .then((d:any)=> setRows(Array.isArray(d)? d : (d?.data||[])))
            .finally(()=> setLoading(false));
    },[isLoading,token,user]);

    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase();
        if(!t) return rows;
        return rows.filter(r =>
            [r.name,r.code,String(r.trips||''),String(r.personnel||''),String(r.revenue||'')]
                .some(x=> String(x||'').toLowerCase().includes(t))
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Firmalar</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (ad, kod)…"
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
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? ((page-1)*pageSize+1) : 0}–{Math.min(page*pageSize, total)}</b> / {total} •
                    &nbsp;Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[800px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad</th>
                            <th>Kod</th>
                            <th>Sefer</th>
                            <th>Personel</th>
                            <th>Gelir</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paged.map(c=>(
                            <tr key={c.id} className="border-t">
                                <td className="py-2">{c.name}</td>
                                <td>{c.code}</td>
                                <td>{c.trips ?? 0}</td>
                                <td>{c.personnel ?? 0}</td>
                                <td>{fmtTL(c.revenue)}</td>
                            </tr>
                        ))}
                        {!paged.length && !loading && (
                            <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> kayıt</div>
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
