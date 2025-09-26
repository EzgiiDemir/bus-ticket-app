// app/dashboard/ik/.../Orders.tsx  (Siparişler)
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
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
type Stat = {
    orders:number; revenue:number; active_trips:number; upcoming_trips:number;
    daily:{ d:string; t:number }[];
};

/* ---------- Formatlayıcılar ---------- */
const TRYc = new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 });
const fmtTR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const toNum = (v:any)=> Number((typeof v==='string' ? v.replace(',','.') : v) || 0);
const clamp = (n:number, min:number, max:number)=> Math.max(min, Math.min(max, n));

/* ---------- URL yardımcıları (Laravel pagination absolute/relative karışımı için) ---------- */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');
const toPath = (u?:string|null)=>{
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try{ const url = new URL(u); return url.pathname + url.search; }
    catch{ return (API_BASE && (u||'').startsWith(API_BASE)) ? (u as string).slice(API_BASE.length) : u; }
};

export default function Orders(){
    const { isLoading, token } = (myAppHook() as any) || {};

    /* ---------- Axios taban & yetkili kısayollar ---------- */
    useEffect(()=>{
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
    },[]);
    const withAuth = (cfg?:AxiosRequestConfig):AxiosRequestConfig => {
        const headers:any = { Accept:'application/json', ...(cfg?.headers||{}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        return { ...cfg, headers };
    };
    const GET = useCallback(async <T=any,>(path:string, cfg?:AxiosRequestConfig)=> {
        const { data } = await axios.get<T>(path, withAuth(cfg));
        return data;
    },[token]);

    /* ---------- State ---------- */
    const [page,setPage]=useState<Page<Order>|null>(null);
    const [q,setQ]=useState('');
    const [perPage,setPerPage]=useState(10);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState('');
    const [stats,setStats]=useState<Stat|null>(null); // "Hepsini CSV" üst bilgi için

    const safePer = clamp(perPage, 5, 100);

    /* ---------- Veri yükleme ---------- */
    const load = useCallback(async (url?:string) => {
        if (!token) return;
        setLoading(true); setErr('');
        try{
            const data = await GET<Page<Order>>(url || '/personnel/orders', {
                params: url ? undefined : { q, per_page: safePer }
            });
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
    },[q, safePer, token, GET]);

    useEffect(()=>{ if(!isLoading && token) void load(); },[isLoading, token, load]);

    // Debounce: arama veya sayfa boyutu değişince tazele
    useEffect(()=>{ if(isLoading || !token) return;
        const t = setTimeout(()=> void load('/personnel/orders'), 300);
        return ()=> clearTimeout(t);
    },[q, safePer, isLoading, token, load]);

    /* ================= CSV altyapısı: Sunucu → İstemci fallback ================= */
    // 1) CSV kaçış + BOM + ; ayırıcı
    const csvEscape = (v:any) => {
        const s = v==null ? '' : String(v);
        return /[\";\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const buildCsv = (headings:string[], rows:(string|number)[][]) => {
        const bom = '\uFEFF';
        const head = headings.length ? headings.map(csvEscape).join(';') + '\n' : '';
        const body = rows.map(r=>r.map(csvEscape).join(';')).join('\n');
        return bom + head + body + (body ? '\n' : '');
    };
    const download = (filename:string, text:string) => {
        const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    };
    // 2) Sunucu varsa export/array endpoint'i kullan; değilse istemci üret
    const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][]) => {
        try{
            const res = await fetch('/company/export/array', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
                body: JSON.stringify({ filename, headings, rows })
            });
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = filename;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
        }catch{
            const text = buildCsv(headings, rows);
            download(filename, text);
        }
    };

    /* ---------- CSV dönüştürücüler ---------- */
    const headings = ['ID','PNR','Sefer','Güzergâh','Kalkış','Adet','Birim','Toplam','Sipariş Tarihi'];
    const orderToRow = (o:Order):(string|number)[] => ([
        o.id,
        o.pnr,
        (o.product?.trip||'-'),
        `${o.product?.terminal_from||''} → ${o.product?.terminal_to||''}`,
        fmtTR(o.product?.departure_time),
        o.qty,
        toNum(o.unit_price),
        toNum(o.total),
        fmtTR(o.created_at),
    ]);

    // Sayfa CSV
    const exportPageCsv = ()=> saveCsv(
        `siparisler_sayfa_${page?.current_page||1}.csv`,
        headings,
        (page?.data||[]).map(orderToRow)
    );

    // Hepsini CSV: filtre aktifken tüm sayfaları dolaşır (limit güvenliği ile)
    const exportAllCsv = async ()=>{
        if (!token) return;
        const all: (string|number)[][] = [];
        let cur = 1;
        const maxPages = 200; // güvenlik
        const per = 100;      // hızlı çekim
        while (cur <= (page?.last_page||1) && cur <= maxPages) {
            const data = await GET<Page<Order>>('/personnel/orders', { params:{ q, per_page: per, page: cur } });
            const items = Array.isArray(data?.data) ? data.data : [];
            items.forEach(o=> all.push(orderToRow(o)));
            if (cur >= (data?.last_page||cur)) break;
            cur++;
        }
        await saveCsv(`siparisler_filtrelenmis_tumu.csv`, headings, all);
    };

    // Tek satır CSV
    const exportRowCsv = (o:Order)=> saveCsv(
        `siparis_${o.id}.csv`,
        headings,
        [orderToRow(o)]
    );

    /* ---------- UI ---------- */
    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    const rows = page?.data ?? [];

    return (
        <div className="space-y-4 text-indigo-900">
            {/* Başlık + arama + CSV butonları */}
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
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportPageCsv}>Sayfa CSV</button>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportAllCsv}>Hepsini CSV</button>
                </div>
            </div>

            {/* Hata kutusu */}
            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{page?.from ?? 0}–{page?.to ?? 0}</b> / {page?.total ?? 0}
                </div>

                {/* Tablo + her satırda CSV butonu */}
                <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">ID</th>
                            <th className="py-2">PNR</th>
                            <th>Sefer</th>
                            <th>Güzergâh</th>
                            <th>Kalkış</th>
                            <th>Adet</th>
                            <th>Birim</th>
                            <th>Toplam</th>
                            <th>Sipariş Tarihi</th>
                            <th className="text-right">CSV</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map(o=>(
                            <tr key={o.id} className="border-t">
                                <td className="py-2">{o.id}</td>
                                <td className="py-2 font-mono">{o.pnr}</td>
                                <td className="font-medium">{o.product?.trip || '-'}</td>
                                <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                                <td>{fmtTR(o.product?.departure_time)}</td>
                                <td>{o.qty}</td>
                                <td>{TRYc.format(toNum(o.unit_price))}</td>
                                <td className="font-semibold">{TRYc.format(toNum(o.total))}</td>
                                <td>{fmtTR(o.created_at)}</td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border" onClick={()=>exportRowCsv(o)}>CSV</button>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && !loading && (
                            <tr><td colSpan={10} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Sayfalama */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
                    <div className="text-xs text-indigo-900/60">
                        Sayfa {page?.current_page ?? 0} / {page?.last_page ?? 0}
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={!page?.prev_page_url || loading}
                            onClick={()=> page?.prev_page_url && load(toPath(page.prev_page_url) as string)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >Geri</button>
                        <button
                            disabled={!page?.next_page_url || loading}
                            onClick={()=> page?.next_page_url && load(toPath(page.next_page_url) as string)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >İleri</button>
                    </div>
                </div>

                {loading && <div className="mt-3 text-sm text-gray-500">Yükleniyor…</div>}
            </div>
        </div>
    );
}
