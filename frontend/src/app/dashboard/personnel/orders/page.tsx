'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type ProductLite = {
    id:number; trip?:string; terminal_from:string; terminal_to:string;
    departure_time?:string; cost?:number|string;
};
type Order = {
    id:number; qty:number; unit_price:number|string; total:number|string;
    pnr:string; created_at?:string; product?:ProductLite;
};
type Page<T> = {
    data:T[]; current_page:number; last_page:number; total:number;
    next_page_url?:string|null; prev_page_url?:string|null;
    from?:number|null; to?:number|null;
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ---------- Yardımcılar ---------- */
const TRYc = new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 });
const fmtTR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const toNum = (v:any)=> Number((typeof v==='string' ? v.replace(',','.') : v) || 0);
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');
const toPath = (u?:string|null)=>{
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try{ const url = new URL(u); return url.pathname + url.search; }
    catch{ return (API_BASE && u.startsWith(API_BASE)) ? u.slice(API_BASE.length) : u; }
};
const clamp = (n:number, min:number, max:number)=> Math.max(min, Math.min(max, n));

/* ---------- Sayfa ---------- */
export default function Orders(){
    const { isLoading, token } = (myAppHook() as any) || {};

    const [page,setPage]=useState<Page<Order>|null>(null);
    const [q,setQ]=useState('');
    const [perPage,setPerPage]=useState(10);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState('');

    const safePer = clamp(perPage, 5, 100);

    const load = useCallback(async (url?:string) => {
        if (!token) return;
        setLoading(true); setErr('');
        try{
            const { data } = await axios.get<Page<Order>>(url || '/personnel/orders', {
                params: url ? undefined : { q, per_page: safePer },
                headers: { Accept: 'application/json' },
            });
            // Laravel paginate garantisi: data dizisi olmalı
            setPage({
                ...data,
                data: Array.isArray(data?.data) ? data.data : [],
                current_page: Number(data?.current_page||1),
                last_page: Number(data?.last_page||1),
                total: Number(data?.total||0),
                from: data?.from ?? null,
                to: data?.to ?? null,
                next_page_url: data?.next_page_url ?? null,
                prev_page_url: data?.prev_page_url ?? null,
            });
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Veri alınamadı.');
            setPage(null);
        }finally{
            setLoading(false);
        }
    },[q, safePer, token]);

    useEffect(()=>{ if(!isLoading && token) void load(); },[isLoading, token, load]);

    // q / perPage değişiminde debounce
    useEffect(()=>{
        if(isLoading || !token) return;
        const t = setTimeout(()=> void load('/personnel/orders'), 350);
        return ()=> clearTimeout(t);
    },[q, safePer, isLoading, token, load]);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    const rows = page?.data ?? [];

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
                        aria-label="Sipariş ara"
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={perPage}
                        onChange={e=>setPerPage(Number(e.target.value))}
                        aria-label="Sayfa başına"
                    >
                        {[10,20,50].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>

                </div>
            </div>

            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{page?.from ?? 0}–{page?.to ?? 0}</b> / {page?.total ?? 0} •
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
                                <td>{TRYc.format(toNum(o.unit_price))}</td>
                                <td className="font-semibold">{TRYc.format(toNum(o.total))}</td>
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
                            onClick={()=> page?.prev_page_url && load(toPath(page.prev_page_url) as string)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            aria-label="Geri"
                        >Geri</button>
                        <button
                            disabled={!page?.next_page_url || loading}
                            onClick={()=> page?.next_page_url && load(toPath(page.next_page_url) as string)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            aria-label="İleri"
                        >İleri</button>
                    </div>
                </div>

                {loading && <div className="mt-3 text-sm text-gray-500">Yükleniyor…</div>}
            </div>
        </div>
    );
}
