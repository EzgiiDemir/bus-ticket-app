'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { exportCSV } from '@/app/lib/export';

type ProductLite = {
    id:number; trip?:string; terminal_from:string; terminal_to:string;
    departure_time:string; cost:number;
};
type Order = {
    id:number; qty:number; unit_price:number; total:number;
    pnr:string; created_at:string; product:ProductLite;
};
type Page<T> = {
    data:T[];
    current_page:number; last_page:number;
    next_page_url?:string|null; prev_page_url?:string|null;
    from?:number|null; to?:number|null; total:number;
};

const fmtTR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

const fmtTL = (n:any) =>
    new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number(n||0));

export default function Orders(){
    const [page,setPage]=useState<Page<Order>|null>(null);
    const [q,setQ]=useState('');
    const [perPage,setPerPage]=useState(10);
    const [loading,setLoading]=useState(false);

    const load = async (url?:string) => {
        setLoading(true);
        try{
            const res = await axios.get<Page<Order>>(url || '/personnel/orders', { params:{ q, per_page:perPage } });
            setPage(res.data);
        } finally { setLoading(false); }
    };
    useEffect(()=>{ load(); /* ilk yük */ },[]);
    // q / perPage değişince ilk sayfadan getir (debounce basit)
    useEffect(()=>{
        const t = setTimeout(()=> load('/personnel/orders'), 350);
        return ()=>clearTimeout(t);
    },[q, perPage]);

    const rows = page?.data ?? [];
    const summary = useMemo(()=>({
        count: rows.length,
        total: rows.reduce((a,b)=> a + Number(b.total||0), 0)
    }),[rows]);

    return (
        <div className="space-y-4 text-indigo-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Siparişler</h1>
                <div className="flex gap-2 items-center">
                    <input
                        className="w-52 rounded-xl border px-3 py-2"
                        placeholder="Ara (PNR, sefer, yol)…"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={perPage}
                        onChange={e=>setPerPage(Number(e.target.value))}
                        aria-label="Sayfa başına"
                    >
                        {[10,20,50].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button
                        className="rounded-xl border px-3 py-2"
                        onClick={()=>{
                            const r = page?.data ?? [];
                            exportCSV('siparisler_sayfa', r, [
                                { key:'pnr', title:'PNR' },
                                { key:'product.trip', title:'Sefer', map:(o:any)=>o.product?.trip || '' },
                                { key:'route', title:'Güzergah', map:(o:any)=>`${o.product?.terminal_from} → ${o.product?.terminal_to}` },
                                { key:'departure', title:'Kalkış', map:(o:any)=>o.product?.departure_time || '' },
                                { key:'qty', title:'Adet' },
                                { key:'unit_price', title:'Birim' },
                                { key:'total', title:'Toplam' },
                                { key:'created_at', title:'Sipariş Tarihi' },
                            ]);
                        }}
                    >CSV</button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{page?.from ?? 0}–{page?.to ?? 0}</b> / {page?.total ?? 0} •
                    &nbsp;Sayfada {summary.count} kayıt • Toplam: <b>{fmtTL(summary.total)}</b>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">PNR</th>
                            <th>Sefer</th>
                            <th>Güzergah</th>
                            <th>Kalkış</th>
                            <th>Adet</th>
                            <th>Birim</th>
                            <th>Toplam</th>
                            <th>Sipariş Tarihi</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map(o=>(
                            <tr key={o.id} className="border-t">
                                <td className="py-2 font-mono">{o.pnr}</td>
                                <td className="font-medium">{o.product?.trip || '-'}</td>
                                <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                                <td>{fmtTR(o.product?.departure_time)}</td>
                                <td>{o.qty}</td>
                                <td>{fmtTL(o.unit_price)}</td>
                                <td className="font-semibold">{fmtTL(o.total)}</td>
                                <td>{fmtTR(o.created_at)}</td>
                            </tr>
                        ))}
                        {!rows.length && !loading && (
                            <tr><td colSpan={8} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
                    <div className="text-xs text-indigo-900/60">
                        Sayfa {page?.current_page ?? 0} / {page?.last_page ?? 0}
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={!page?.prev_page_url || loading}
                            onClick={()=> page?.prev_page_url && load(page.prev_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >Geri</button>
                        <button
                            disabled={!page?.next_page_url || loading}
                            onClick={()=> page?.next_page_url && load(page.next_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >İleri</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
