// app/dashboard/ik/.../Customers.tsx  (Müşteriler)
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type Customer = { passenger_name:string; passenger_email:string; passenger_phone?:string|null };
type Page<T> = {
    data:T[]; current_page:number; last_page:number; total:number;
    from?:number|null; to?:number|null;
    next_page_url?:string|null; prev_page_url?:string|null;
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };
type Stat = {
    orders:number; revenue:number; active_trips:number; upcoming_trips:number;
    daily:{ d:string; t:number }[];
};

/* ---------- URL yardımcıları (Laravel sayfalama) ---------- */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');
const toPath = (u?:string|null)=>{
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try{ const url = new URL(u); return url.pathname + url.search; }
    catch{ return (API_BASE && (u||'').startsWith(API_BASE)) ? (u as string).slice(API_BASE.length) : u; }
};
const clamp = (n:number,min:number,max:number)=> Math.max(min, Math.min(max, n));

export default function Customers(){
    const { isLoading, token } = (myAppHook() as any) || {};

    /* ---------- Axios tabanı + yetkili kısayol ---------- */
    useEffect(()=>{
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
    },[]);
    const withAuth = (cfg?:AxiosRequestConfig):AxiosRequestConfig=>{
        const headers:any = { Accept:'application/json', ...(cfg?.headers||{}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        return { ...cfg, headers };
    };
    const GET = useCallback(async <T=any,>(path:string, cfg?:AxiosRequestConfig)=>{
        const { data } = await axios.get<T>(path, withAuth(cfg));
        return data;
    },[token]);

    /* ---------- State ---------- */
    const [page,setPage]=useState<Page<Customer>|null>(null);
    const [q,setQ]=useState('');
    const [perPage,setPerPage]=useState(10);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState('');
    const [banner,setBanner]=useState('');
    const [stats,setStats]=useState<Stat|null>(null); // Hepsini CSV üst bilgi için

    const safePer = clamp(perPage, 10, 100);

    /* ---------- Veri yükleme ---------- */
    const fetchPage = useCallback(async (url?:string)=>{
        setLoading(true); setErr(''); setBanner('');
        try{
            const data = await GET<Page<Customer>>(url || '/personnel/customers', {
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
            setBanner(`Toplam ${data?.total ?? 0} kayıt. Sayfa ${data?.current_page ?? 0}/${data?.last_page ?? 0}.`);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Veri alınamadı.');
            setPage(null);
        }finally{
            setLoading(false);
        }
    },[q, safePer, GET]);

    useEffect(()=>{ if(!isLoading && token) void fetchPage(); },[isLoading, token, fetchPage]);

    // Debounce: arama/sayfa boyutu değişince ~300ms sonra yeniden yükle
    useEffect(()=>{ if(isLoading || !token) return;
        const t = setTimeout(()=> void fetchPage('/personnel/customers'), 300);
        return ()=> clearTimeout(t);
    },[q, safePer, isLoading, token, fetchPage]);

    /* ================= CSV altyapısı: Sunucu → İstemci fallback ================= */
    // 1) CSV kaçış + BOM + ; ayırıcı (Excel/TR uyumlu)
    const csvEscape = (v:any) => {
        const s = v==null ? '' : String(v);
        return /[\";\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
        // Not: ;, ", \n içeren hücreler tırnaklanır.
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
    // 2) Sunucu varsa export/array endpoint’i kullan; yoksa istemci üret
    const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][])=>{
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
    const headings = ['ID','Ad','E-posta','Telefon'];
    const rowFromCustomer = (c:Customer, idx:number):(string|number)[] => ([
        (Number(page?.from||0) + idx),
        c.passenger_name,
        c.passenger_email,
        c.passenger_phone || ''
    ]);

    // Sayfa CSV
    const exportPageCsv = ()=> saveCsv(
        `musteriler_sayfa_${page?.current_page||1}.csv`,
        headings,
        (page?.data||[]).map(rowFromCustomer)
    );

    // Hepsini CSV: aktif filtre ile tüm sayfaları çeker (güvenlik limiti ile)
    const exportAllCsv = async ()=>{
        if(!token) return;
        const all:(string|number)[][] = [];
        const per = 100;          // hızlı çekim
        const maxPages = 200;     // güvenlik
        let cur = 1;
        while (cur <= (page?.last_page||1) && cur <= maxPages) {
            const data = await GET<Page<Customer>>('/personnel/customers', { params:{ q, per_page: per, page: cur } });
            const arr = Array.isArray(data?.data) ? data.data : [];
            arr.forEach((c, i)=> all.push([
                (Number(data?.from||0) + i),
                c.passenger_name,
                c.passenger_email,
                c.passenger_phone || ''
            ]));
            if (cur >= (data?.last_page||cur)) break;
            cur++;
        }
        await saveCsv('musteriler_filtrelenmis_tumu.csv', headings, all);
    };

    // Tek satır CSV (tablodaki her satır için)
    const exportRowCsv = (c:Customer, idx:number)=> saveCsv(
        `musteri_${Number(page?.from||0)+idx}.csv`,
        headings,
        [rowFromCustomer(c, idx)]
    );

    /* ---------- UI ---------- */
    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    const rows = page?.data ?? [];
    const count = useMemo(()=> rows.length, [rows]);

    return (
        <div className="space-y-4 text-indigo-900">
            {/* Başlık + arama + CSV butonları */}
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
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportPageCsv}>Sayfa CSV</button>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportAllCsv}>Hepsini CSV</button>
                </div>
            </div>

            {/* Bilgi/Hata bantları */}
            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{page?.from ?? 0}–{page?.to ?? 0}</b> / {page?.total ?? 0} • Bu sayfada {count} kişi
                </div>

                {/* Tablo + her satırda CSV butonu */}
                <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">ID</th>
                            <th className="py-2">Ad</th>
                            <th>E-posta</th>
                            <th>Telefon</th>
                            <th className="text-right">CSV</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((c,i)=>(
                            <tr key={`${c.passenger_email}-${i}`} className="border-t">
                                <td className="py-2">{(Number(page?.from||0) + i)}</td>
                                <td className="py-2 font-medium">{c.passenger_name}</td>
                                <td>{c.passenger_email}</td>
                                <td>{c.passenger_phone || '-'}</td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border" onClick={()=>exportRowCsv(c,i)}>CSV</button>
                                </td>
                            </tr>
                        ))}
                        {!rows.length && !loading && (
                            <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
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
                            onClick={()=> page?.prev_page_url && fetchPage(toPath(page.prev_page_url) as string)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >Geri</button>
                        <button
                            disabled={!page?.next_page_url || loading}
                            onClick={()=> page?.next_page_url && fetchPage(toPath(page.next_page_url) as string)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >İleri</button>
                    </div>
                </div>

                {loading && <div className="mt-3 text-sm text-gray-500">Yükleniyor…</div>}
            </div>
        </div>
    );
}
