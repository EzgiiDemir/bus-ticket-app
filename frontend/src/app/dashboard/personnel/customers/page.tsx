'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type Customer = { passenger_name:string; passenger_email:string; passenger_phone?:string|null };
type Page<T> = {
    data:T[]; current_page:number; last_page:number; total:number;
    from?:number|null; to?:number|null;
    next_page_url?:string|null; prev_page_url?:string|null;
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ---------- Yardımcılar ---------- */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');
const toPath = (u?:string|null)=>{
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try{ const url = new URL(u); return url.pathname + url.search; }
    catch{ return (API_BASE && u.startsWith(API_BASE)) ? u.slice(API_BASE.length) : u; }
};
const clamp = (n:number,min:number,max:number)=> Math.max(min, Math.min(max, n));

/* ---------- Sayfa ---------- */
export default function Customers(){
    const { isLoading, token, user } = (myAppHook() as any) || {};

    const [page,setPage]=useState<Page<Customer>|null>(null);
    const [q,setQ]=useState('');
    const [perPage,setPerPage]=useState(10);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState('');
    const [banner,setBanner]=useState('');

    const safePer = clamp(perPage, 10, 100);

    const fetchPage = useCallback(async (url?:string)=>{
        setLoading(true); setErr(''); setBanner('');
        try{
            const { data } = await axios.get<Page<Customer>>(url || '/personnel/customers', {
                params: url ? undefined : { q, per_page: safePer },
                headers: { Accept:'application/json' }
            });
            setPage(data);
            setBanner(`Toplam ${data?.total ?? 0} kayıt. Sayfa ${data?.current_page ?? 0}/${data?.last_page ?? 0}.`);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Veri alınamadı.');
            setPage(null);
        }finally{
            setLoading(false);
        }
    },[q, safePer]);

    useEffect(()=>{ if(!isLoading && token) void fetchPage(); },[isLoading, token, fetchPage]);

    // Arama/perPage debounce
    useEffect(()=>{
        if(isLoading || !token) return;
        const t = setTimeout(()=> void fetchPage('/personnel/customers'), 300);
        return ()=> clearTimeout(t);
    },[q, safePer, isLoading, token, fetchPage]);


    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    const rows = page?.data ?? [];
    const count = useMemo(()=> rows.length, [rows]);

    return (
        <div className="space-y-4 text-indigo-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Müşteriler</h1>
                <div className="flex items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (ad, e-posta, tel)…"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                        aria-label="Müşteri ara"
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

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{page?.from ?? 0}–{page?.to ?? 0}</b> / {page?.total ?? 0} •
                    &nbsp;Bu sayfada {count} kişi
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad</th><th>E-posta</th><th>Telefon</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((c,i)=>(
                            <tr key={i} className="border-t">
                                <td className="py-2 font-medium">{c.passenger_name}</td>
                                <td>{c.passenger_email}</td>
                                <td>{c.passenger_phone || '-'}</td>
                            </tr>
                        ))}
                        {!rows.length && !loading && (
                            <tr><td colSpan={3} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
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
                            onClick={()=> page?.prev_page_url && fetchPage(page.prev_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            aria-label="Geri"
                        >Geri</button>
                        <button
                            disabled={!page?.next_page_url || loading}
                            onClick={()=> page?.next_page_url && fetchPage(page.next_page_url)}
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
