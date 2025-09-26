// app/dashboard/admin/trips/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listTrips } from '../../../../lib/adminApi';
import { fmtTR } from '../../../../lib/datetime';
import moment from "moment";
import "moment/locale/tr";
import { BASE } from '@/app/lib/api';

/* ---------- Tipler ---------- */
type Trip = {
    id:number; trip?:string;
    company_name?:string; company?:{ name?:string };
    terminal_from:string; terminal_to:string; departure_time:string;
    cost:number|string; cost_tl?:number;
    capacity_reservation:number; is_active:boolean|number;
    orders?:number|string; seats?:number|string;
    revenue?:number|string; revenue_tl?:number;
    minutes_left?:number; remaining_human?:string;
};

/* ---------- Sayısal yardımcılar ---------- */
const TRYc = new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2});
const toNum = (v:any)=> Number((typeof v==="string" ? v.replace(/\./g,"").replace(",",".") : v) || 0);
const normalizeMoney = (v:any)=> { const n = toNum(v); return n >= 1000 && n % 100 === 0 ? n/100 : n; };
const fmtTLnum = (n:number)=> TRYc.format(Number(n||0));

/* Kalkışa kalan süre metni */
const humanRemain = (iso?:string, server?:string)=> {
    if (server) return server;
    if (!iso) return "—";
    const d = moment(iso.includes("T") ? iso : iso.replace(" ","T"));
    if (!d.isValid()) return "—";
    const diff = d.diff(moment(), "minutes");
    if (diff <= 0) return "—";
    const h = Math.floor(diff/60), m = diff%60;
    if (h && m) return `${h} saat ${m} dk`;
    if (h)       return `${h} saat`;
    return `${m} dk`;
};

/* ---------- CSV: sunucu→istemci fallback ---------- */
const csvEscape = (v:any)=>{ const s=String(v??''); return /[\";\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
const buildCsv = (head:string[], rows:(string|number)[][])=>{
    const bom='\uFEFF'; const h=head.length?head.map(csvEscape).join(';')+'\n':'';
    const b=rows.map(r=>r.map(csvEscape).join(';')).join('\n'); return bom+h+b+(b?'\n':'');
};
const downloadText=(filename:string,text:string)=>{
    const blob=new Blob([text],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
};
const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][], token?:string)=>{
    try{
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename, headings, rows }),
        });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob(); const a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    }catch{ downloadText(filename, buildCsv(headings, rows)); }
};

export default function AdminTrips(){
    const { token, isLoading, user } = myAppHook() as any;

    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState(""); const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10); const [loading,setLoading]=useState(false);

    /* Listeyi çek */
    useEffect(()=>{ if (isLoading || !token || user?.role!=="admin") return;
        setLoading(true);
        listTrips({ q }).then((d:any)=>{
            const arr:Trip[] = Array.isArray(d) ? d : (d?.trips || d?.data || []);
            setRows(arr);
        }).finally(()=>setLoading(false));
    },[isLoading, token, user, q]);

    /* Filtre + sayfalama */
    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase(); if(!t) return rows;
        return rows.filter(r =>
            [r.trip, r.company_name, r.company?.name, r.terminal_from, r.terminal_to, r.departure_time]
                .some(x => String(x||"").toLowerCase().includes(t))
        );
    },[rows,q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages,page]);
    const paged = useMemo(()=> filtered.slice((page-1)*pageSize, (page-1)*pageSize + pageSize), [filtered,page,pageSize]);

    /* CSV exportları */
    const headers = ['ID','Sefer','Firma','Güzergah','Kalkış','Kalan','Ücret','Kapasite','Aktif','Sipariş','Koltuk'];
    const rowToCsv = (t:Trip):(string|number)[]=>[
        t.id, t.trip||'-', (t.company_name||t.company?.name||'-'),
        `${t.terminal_from} → ${t.terminal_to}`, fmtTR(t.departure_time),
        (t.remaining_human||humanRemain(t.departure_time)||'-'),
        Number(t.cost_tl ?? normalizeMoney(t.cost)), t.capacity_reservation,
        t.is_active?'Evet':'Hayır', toNum(t.orders), toNum(t.seats)
    ];
    const exportPageCsv = ()=> saveCsv('seferler_sayfa.csv', headers, paged.map(rowToCsv), token);
    const exportAllCsv  = ()=> saveCsv('seferler_tumu.csv', headers, filtered.map(rowToCsv), token);
    const exportOneCsv  = (t:Trip)=> saveCsv(`sefer_${t.id}.csv`, headers, [rowToCsv(t)], token);

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=="admin") return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-indigo-900/80">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input className="w-56 rounded-xl border px-3 py-2" placeholder="Ara…" value={q}
                           onChange={e=>{ setQ(e.target.value); setPage(1); }}/>
                    <select className="rounded-xl border px-3 py-2" value={pageSize}
                            onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportPageCsv}>Sayfa CSV</button>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportAllCsv}>Tümü CSV</button>
                </div>
            </div>

            {/* Tablo */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? (page-1)*pageSize+1 : 0}–{Math.min(page*pageSize, total)}</b> / {total} • Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">ID</th>
                            <th className="py-2">Sefer</th>
                            <th>Firma</th>
                            <th>Güzergah</th>
                            <th>Kalkış</th>
                            <th>Kalan</th>
                            <th>Ücret</th>
                            <th>Kapasite</th>
                            <th>Aktif</th>
                            <th className="text-right">Sipariş</th>
                            <th className="text-right">Koltuk</th>
                            <th className="text-right">CSV</th> {/* satır CSV */}
                        </tr>
                        </thead>
                        <tbody>
                        {paged.map((t,i)=>(
                            <tr key={t.id} className={`border-t ${i%2?'bg-indigo-50/20':''}`}>
                                <td className="py-2">{t.id}</td>
                                <td className="py-2">{t.trip||'-'}</td>
                                <td>{t.company_name || t.company?.name || "-"}</td>
                                <td>{t.terminal_from} → {t.terminal_to}</td>
                                <td>{fmtTR(t.departure_time)}</td>
                                <td>{humanRemain(t.departure_time, t.remaining_human)}</td>
                                <td>{fmtTLnum(Number(t.cost_tl ?? normalizeMoney(t.cost)))}</td>
                                <td>{t.capacity_reservation}</td>
                                <td>
                    <span className={`px-2 py-0.5 rounded-lg text-xs border ${t.is_active?'border-emerald-300 bg-emerald-50 text-emerald-700':'border-rose-300 bg-rose-50 text-rose-700'}`}>
                      {t.is_active?'Evet':'Hayır'}
                    </span>
                                </td>
                                <td className="text-right">{toNum(t.orders)}</td>
                                <td className="text-right">{toNum(t.seats)}</td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border" onClick={()=>exportOneCsv(t)}>CSV</button>
                                </td>
                            </tr>
                        ))}
                        {!paged.length && !loading && <tr><td colSpan={12} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* Sayfalama */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> sefer</div>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Önceki</button>
                        <span className="text-sm">{page} / {totalPages}</span>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Sonraki</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
