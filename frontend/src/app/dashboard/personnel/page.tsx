'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { exportCSV } from '@/app/lib/export';
import { myAppHook } from '../../../../context/AppProvider';

/* ---------- Types ---------- */
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

/* ---------- Helpers ---------- */
const TRYc = new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 });
const fmtTL = (n:any) => TRYc.format(Number(n||0));
const fmtTR = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

/* ---------- Component ---------- */
export default function Overview(){
    const { token, isLoading } = (myAppHook() as any) || {};
    const [stats,setStats]=useState<Stat|null>(null);
    const [orders,setOrders]=useState<OrderRow[]>([]);
    const [loading,setLoading]=useState(true);
    const [err,setErr]=useState('');

    // axios base
    useEffect(()=>{
        const base = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000');
        axios.defaults.baseURL = base;
        axios.defaults.withCredentials = true;
    },[]);

    // GET wrapper (adds Accept and Bearer if available)
    const GET = useCallback(async <T=any,>(path:string, config?:AxiosRequestConfig) => {
        const headers:any = { Accept:'application/json', ...(config?.headers||{}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await axios.get<T>(path, { ...config, headers });
        return res.data;
    },[token]);

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

    useEffect(()=>{
        if(isLoading) return;
        let mounted = true;
        (async ()=>{
            setLoading(true); setErr('');
            try{
                // 1) revenue timeseries (admin)
                let daily: {d:string;t:number}[] = [];
                try{
                    const ts = await GET<any>('/admin/dashboard/revenue-timeseries');
                    daily = normTimeseries(ts);
                }catch{/* ignore */}

                // 2) overview (admin -> personnel fallback)
                let ov: Stat|null = null;
                try{
                    const a = await GET<any>('/admin/dashboard/overview');
                    ov = normOverview(a, daily);
                }catch{
                    try{
                        const p = await GET<any>('/personnel/stats');
                        ov = normOverview(p, daily);
                    }catch{/* ignore */}
                }
                if(!ov) ov = { orders:0, revenue:0, active_trips:0, upcoming_trips:0, daily };

                // 3) latest orders (any role)
                let last:OrderRow[] = [];
                try{
                    const o = await GET<any>('/orders?per_page=5');
                    const list = Array.isArray(o?.data) ? o.data : Array.isArray(o) ? o : [];
                    last = list as OrderRow[];
                }catch{/* ignore */}

                if(mounted){ setStats(ov); setOrders(last); }
            }catch(e:any){
                const p:ApiErr|undefined = e?.response?.data;
                setErr(p?.message || (p?.errors && Object.values(p.errors).flat().join('\n')) || 'Veriler alınamadı.');
            }finally{
                if(mounted) setLoading(false);
            }
        })();
        return ()=>{ mounted=false; };
    },[isLoading, GET]);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;

    const dailyChart = (stats?.daily||[]).map(d=>({ date:d.d, revenue:d.t }));

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 whitespace-pre-line">{err}</div>}

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card title="Sipariş" value={stats?.orders ?? 0}/>
                <Card title="Gelir" value={fmtTL(stats?.revenue ?? 0)}/>
                <Card title="Aktif Sefer" value={stats?.active_trips ?? 0}/>
                <Card title="Yaklaşan" value={stats?.upcoming_trips ?? 0}/>
            </div>

            {/* Revenue chart + export */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-2xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-indigo-900">Son 7 Gün Gelir</h2>
                        <button
                            className="px-3 py-1 rounded-lg border text-indigo-900"
                            onClick={()=>{
                                const rows = (stats?.daily||[]).map(d=>({ tarih:d.d, gelir:d.t }));
                                exportCSV('son7gun_gelir', rows, [
                                    { key:'tarih', title:'Tarih' },
                                    { key:'gelir', title:'Gelir' },
                                ]);
                            }}
                            aria-label="CSV dışa aktar"
                        >CSV</button>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyChart}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="revenue" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------- UI ---------- */
function Card({title,value}:{title:string;value:any}){
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold text-indigo-900">{value}</div>
        </div>
    );
}
