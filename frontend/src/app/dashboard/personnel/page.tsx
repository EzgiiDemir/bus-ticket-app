// app/dashboard/ik/.../Overview.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { myAppHook } from '../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type Stat = {
    orders:number;
    revenue:number;
    active_trips:number;
    upcoming_trips:number;
    daily:{ d:string; t:number }[];
};
type OrderRow = {
    id:number; pnr:string; created_at:string; qty:number; total:number;
    product?: { trip?:string; terminal_from?:string; terminal_to?:string; departure_time?:string; cost?:number };
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ---------- Yardımcılar ---------- */
// TL formatlayıcı (kartlarda görünüm için)
const TRYc = new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 });
const fmtTL = (n:any) => TRYc.format(Number(n||0));
// ISO → tr-TR tarih-saat
const fmtTR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

export default function Overview(){
    // App provider'dan token ve yüklenme durumu
    const { token, isLoading } = (myAppHook() as any) || {};
    // UI state'leri
    const [stats,setStats]=useState<Stat|null>(null);
    const [orders,setOrders]=useState<OrderRow[]>([]);
    const [loading,setLoading]=useState(true);
    const [err,setErr]=useState('');

    /* ---------- Axios temel ayar ---------- */
    useEffect(()=>{
        const base = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000');
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
    },[]);

    /* ---------- Yetkili GET kısayolu ---------- */
    const GET = useCallback(async <T=any,>(path:string, config?:AxiosRequestConfig) => {
        const headers:any = { Accept:'application/json', ...(config?.headers||{}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await axios.get<T>(path, { ...config, headers });
        return res.data;
    },[token]);

    /* ---------- API normalize ---------- */
    // Farklı backend alan adlarını tek tip Stat'a çevirir
    const normOverview = (raw:any, dailyFallback:{d:string;t:number}[]=[]):Stat => ({
        orders: Number(raw?.orders ?? raw?.order_count ?? 0),
        revenue: Number(raw?.revenue ?? raw?.total_revenue ?? 0),
        active_trips: Number(raw?.active_trips ?? raw?.active ?? 0),
        upcoming_trips: Number(raw?.upcoming_trips ?? raw?.upcoming ?? 0),
        daily: Array.isArray(raw?.daily)
            ? raw.daily.map((x:any)=>({ d: String(x.d ?? x.date ?? x.day), t: Number(x.t ?? x.total ?? x.revenue ?? 0) }))
            : dailyFallback
    });
    const normTimeseries = (raw:any):{d:string;t:number}[] => {
        const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
        return arr.map((x:any)=>({ d:String(x.d ?? x.date ?? x.day), t:Number(x.t ?? x.total ?? x.revenue ?? 0) }));
    };

    /* ---------- CSV altyapısı ---------- */
    // CSV satır kaçışı; ; ayırıcı kullan (Excel/TR uyumlu). Değer içinde " ; veya \n varsa tırnakla.
    const csvEscape = (v:any) => {
        const s = v==null ? '' : String(v);
        return /[\";\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const buildCsv = (headings:string[], rows:(string|number)[][]) => {
        // UTF-8 BOM ekle (Excel için)
        const bom = '\uFEFF';
        const head = headings.length ? headings.map(csvEscape).join(';') + '\n' : '';
        const body = rows.map(r=>r.map(csvEscape).join(';')).join('\n');
        return bom + head + body + (body ? '\n' : '');
    };
    // Tarayıcıdan indirme
    const download = (filename:string, text:string) => {
        const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    };

    // Sunucuya post ederek export denemesi (varsa). Yoksa tarayıcı fallback.
    const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][]) => {
        const payload = { filename, headings, rows };
        // 1) Sunucu export dene
        try{
            const res = await fetch('/company/export/array', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
                body: JSON.stringify(payload)
            });
            if(!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = filename;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
            return; // başarı
        }catch(_){
            // 2) Fallback: istemci tarafı CSV oluştur ve indir
            const text = buildCsv(headings, rows);
            download(filename, text);
        }
    };

    /* ---------- CSV buton aksiyonları ---------- */
    // Özet tek satır
    const exportOverview = ()=> saveCsv(
        'overview_ozet.csv',
        ['Sipariş','Gelir','Aktif Sefer','Yaklaşan'],
        [[ stats?.orders??0, stats?.revenue??0, stats?.active_trips??0, stats?.upcoming_trips??0 ]]
    );

    // Günlük seri
    const exportDaily = ()=> saveCsv(
        'overview_gunluk_seri.csv',
        ['#','Tarih','Gelir'],
        (stats?.daily||[]).map((x,i)=>[i+1,x.d,x.t])
    );

    // Hepsi tek dosyada, bölüm başlıkları boş satırlarla
    const exportAll = async ()=>{
        const rows:(string|number)[][]=[];
        rows.push(['GENEL ÖZET']);
        rows.push(['Sipariş','Gelir','Aktif Sefer','Yaklaşan']);
        rows.push([ stats?.orders??0, stats?.revenue??0, stats?.active_trips??0, stats?.upcoming_trips??0 ]);
        rows.push([]);
        rows.push(['GÜNLÜK SERİ']);
        rows.push(['#','Tarih','Gelir']);
        (stats?.daily||[]).forEach((x,i)=>rows.push([i+1,x.d,x.t]));
        // headings boş geçilebilir; buildCsv bunu destekliyor
        await saveCsv('overview_HEPSI.csv', [], rows);
    };

    /* ---------- Veri yükleme ---------- */
    useEffect(()=>{
        if(isLoading) return; // token bekleme
        let mounted = true;
        (async ()=>{
            setLoading(true); setErr('');
            try{
                // 1) Gelir zaman serisi
                let daily: {d:string;t:number}[] = [];
                try{ daily = normTimeseries(await GET<any>('/admin/dashboard/revenue-timeseries')); }catch{}
                // 2) Genel özet (önce admin, yoksa personel)
                let ov: Stat|null = null;
                try{ ov = normOverview(await GET<any>('/admin/dashboard/overview'), daily); }
                catch{
                    try{ ov = normOverview(await GET<any>('/personnel/stats'), daily); }catch{}
                }
                if(!ov) ov = { orders:0, revenue:0, active_trips:0, upcoming_trips:0, daily };
                // 3) Son siparişler (isteğe bağlı vitrin)
                try{
                    const o = await GET<any>('/orders?per_page=5');
                    const list = Array.isArray(o?.data) ? o.data : Array.isArray(o) ? o : [];
                    if(mounted) setOrders(list as OrderRow[]);
                }catch{}
                if(mounted) setStats(ov);
            }catch(e:any){
                const p:ApiErr|undefined = e?.response?.data;
                setErr(p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Veriler alınamadı.');
            }finally{ if(mounted) setLoading(false); }
        })();
        return ()=>{ mounted=false; };
    },[isLoading, GET]);

    /* ---------- UI ---------- */
    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    // Grafik veri modeli
    const dailyChart = (stats?.daily||[]).map(d=>({ date:d.d, revenue:d.t }));
    const disableExports = !stats || loading;

    return (
        <div className="space-y-6 text-indigo-900">
            {/* Başlık + CSV butonları */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>
                <div className="flex gap-2">
                    <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            onClick={exportOverview} disabled={disableExports}>Özet CSV</button>
                    <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            onClick={exportDaily} disabled={disableExports}>Günlük CSV</button>
                    <button className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            onClick={exportAll} disabled={disableExports}>Hepsini CSV</button>
                </div>
            </div>

            {/* Hata kutusu */}
            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            {/* Özet kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card title="Sipariş" value={stats?.orders ?? 0}/>
                <Card title="Gelir" value={fmtTL(stats?.revenue ?? 0)}/>
                <Card title="Aktif Sefer" value={stats?.active_trips ?? 0}/>
                <Card title="Yaklaşan" value={stats?.upcoming_trips ?? 0}/>
            </div>

            {/* Zaman serisi grafiği */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-2xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-indigo-900">Son 7 Gün Gelir</h2>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
                                <Line type="monotone" dataKey="revenue" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------- Basit kart ---------- */
function Card({title,value}:{title:string;value:any}){
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold text-indigo-900">{value}</div>
        </div>
    );
}
