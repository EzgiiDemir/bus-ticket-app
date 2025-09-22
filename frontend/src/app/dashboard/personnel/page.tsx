'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { exportCSV } from '@/app/lib/export';
import { myAppHook } from '../../../../context/AppProvider';

type Stat = {
    orders:number;
    revenue:number;
    active_trips:number;
    upcoming_trips:number;
    daily:{ d:string; t:number }[];
};
type OrderRow = {
    id:number; pnr:string; created_at:string; qty:number; total:number;
    product?: { trip?:string; terminal_from:string; terminal_to:string; departure_time:string; cost:number };
};

const fmtTL = (n:any) => new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number(n||0));

export default function Overview(){
    const { token, isLoading } = (myAppHook() as any) || {};
    const [stats,setStats]=useState<Stat|null>(null);
    const [orders,setOrders]=useState<OrderRow[]>([]);
    const [loading,setLoading]=useState(true);

    // axios tabanı
    useEffect(()=>{
        const baseFromEnv = (process.env.NEXT_PUBLIC_API_URL||'http://127.0.0.1:8000').replace(/\/+$/,'') + '/api';
        if(!axios.defaults.baseURL) axios.defaults.baseURL = baseFromEnv;
        axios.defaults.withCredentials = true;
    },[]);

    // helper: GET (Bearer varsa ekle)
    const get = <T=any,>(path:string) =>
        axios.get<T>(path, token ? { headers:{ Authorization:`Bearer ${token}` } } : undefined);

    // normalize
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
            setLoading(true);
            try{
                // 1) timeseries (admin uç)
                let daily: {d:string;t:number}[] = [];
                try{
                    const ts = await get<any>('/admin/dashboard/revenue-timeseries');
                    daily = normTimeseries(ts.data);
                }catch{}

                // 2) overview: admin -> personel fallback
                let ov: Stat|null = null;
                try{
                    const r = await get<any>('/admin/dashboard/overview');
                    ov = normOverview(r.data, daily);
                }catch(e:any){
                    // personel fallback
                    try{
                        const r2 = await get<any>('/personnel/stats');
                        ov = normOverview(r2.data, daily);
                    }catch{}
                }
                if(!ov) ov = { orders:0, revenue:0, active_trips:0, upcoming_trips:0, daily };

                // 3) son siparişler
                let lastOrders:OrderRow[] = [];
                try{
                    const o = await get<any>('/orders?per_page=5');
                    const list = Array.isArray(o.data?.data) ? o.data.data : Array.isArray(o.data) ? o.data : [];
                    lastOrders = list as OrderRow[];
                }catch{}

                if(mounted){
                    setStats(ov);
                    setOrders(lastOrders);
                }
            } finally{
                if(mounted) setLoading(false);
            }
        })();
        return ()=>{ mounted=false; };
    },[isLoading, token]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card title="Sipariş" value={stats?.orders ?? 0}/>
                <Card title="Gelir" value={fmtTL(stats?.revenue ?? 0)}/>
                <Card title="Aktif Sefer" value={stats?.active_trips ?? 0}/>
                <Card title="Yaklaşan" value={stats?.upcoming_trips ?? 0}/>
            </div>

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
                        >CSV</button>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={(stats?.daily||[]).map(d=>({ date:d.d, revenue:d.t }))}>
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

function Card({title,value}:{title:string;value:any}){
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold text-indigo-900">{value}</div>
        </div>
    );
}
