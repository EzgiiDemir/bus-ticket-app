'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { exportCSV, exportJSON } from '@/app/lib/export';
import { myAppHook } from '../../../../context/AppProvider';

type Stat = {
    orders:number; revenue:number; active_trips:number; upcoming_trips:number;
    daily:{ d:string; t:number }[];
};
type OrderRow = {
    id:number; pnr:string; created_at:string; qty:number; total:number;
    passenger_name?:string;
    product?: { trip?: string; terminal_from:string; terminal_to:string; departure_time:string; cost:number; };
};
type Paged<T> = { data:T[]; total:number; per_page:number; current_page:number; next_page_url?:string|null; prev_page_url?:string|null; };

const fmtTR = (iso?:string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
const fmtTL = (n:any) =>
    new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number(n||0));

export default function Overview(){
    const { isLoading, token } = myAppHook() as any;

    const [stats,setStats]=useState<Stat|null>(null);
    const [orders,setOrders]=useState<Paged<OrderRow>|null>(null);
    const [err,setErr]=useState<string>('');
    const [loading,setLoading]=useState(true);

    // orders pagination
    const [oPage,setOPage]=useState(1);
    const [oPerPage,setOPerPage]=useState(10);

    const load = async (page=oPage, perPage=oPerPage) => {
        if (isLoading || !token) return;
        setLoading(true); setErr('');
        try{
            const [sRes, oRes] = await Promise.all([
                axios.get('/personnel/stats', { headers:{ Authorization:`Bearer ${token}` } }),
                axios.get('/personnel/orders', { params:{ page, per_page: perPage }, headers:{ Authorization:`Bearer ${token}` } })
            ]);

            setStats(sRes.data as Stat);

            // paginator (api’ye göre esnek)
            const oData = oRes.data;
            if (oData?.data && typeof oData?.total === 'number') {
                setOrders(oData as Paged<OrderRow>);
            } else if (oData?.orders?.data) {
                setOrders(oData.orders as Paged<OrderRow>);
            } else {
                const rows: OrderRow[] = oData?.orders || oData?.data || [];
                setOrders({
                    data: rows.slice(0, perPage),
                    total: rows.length,
                    per_page: perPage,
                    current_page: 1,
                    next_page_url: null,
                    prev_page_url: null,
                });
            }
        } catch(e:any){
            setErr(e?.response?.data?.message || 'Veriler alınamadı');
        } finally{
            setLoading(false);
        }
    };

    useEffect(()=>{ if(!isLoading && token) load(1, oPerPage); },[isLoading, token, oPerPage]);

    const revenueSeries = useMemo(
        ()=> (stats?.daily||[]).map(d=>({ date:d.d, revenue:d.t })),
        [stats?.daily]
    );
    const totalPages = useMemo(
        ()=> Math.max(1, Math.ceil((orders?.total||0)/(orders?.per_page||oPerPage))),
        [orders, oPerPage]
    );

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)     return <div className="p-6">Lütfen giriş yapın.</div>;
    if (err)        return <div className="p-6 text-red-600">{err}</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card title="Sipariş" value={stats?.orders ?? 0}/>
                <Card title="Gelir" value={fmtTL(stats?.revenue ?? 0)}/>
                <Card title="Aktif Sefer" value={stats?.active_trips ?? 0}/>
                <Card title="Yaklaşan" value={stats?.upcoming_trips ?? 0}/>
            </div>

            {/* Chart */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-2xl border bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-semibold text-indigo-900">Son 7 Gün Gelir</h2>
                        <div className="flex gap-2">
                            <button
                                className="px-3 py-1 rounded-lg border"
                                onClick={()=>{
                                    const rows = (stats?.daily||[]).map(d=>({ Tarih:d.d, Gelir:d.t }));
                                    exportCSV('son7gun_gelir', rows, [{key:'Tarih', title:'Tarih'}, {key:'Gelir', title:'Gelir'}]);
                                }}
                            >CSV</button>
                            <button className="px-3 py-1 rounded-lg border" onClick={()=>exportJSON('son7gun_gelir', stats?.daily||[])}>JSON</button>
                        </div>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueSeries}>
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

                {/* Quick Stats (opsiyonel alan) */}
                <div className="rounded-2xl border bg-white p-4 space-y-2">
                    <Info label="Günlük Ortalama" value={fmtTL(avg((stats?.daily||[]).map(x=>x.t)))} />
                    <Info label="Haftalık Toplam" value={fmtTL(sum((stats?.daily||[]).map(x=>x.t)))} />
                    <Info label="Zirve Gün" value={peakDay(stats?.daily)} />
                </div>
            </div>

        </div>
    );
}

/* UI helpers */
function Card({title,value}:{title:string;value:any}){
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold text-indigo-900">{value}</div>
        </div>
    );
}
function Info({label,value}:{label:string;value:any}){
    return (
        <div className="rounded-xl border p-3">
            <div className="text-xs text-indigo-900/60">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    );
}
function avg(arr:number[]){ if(!arr.length) return 0; return arr.reduce((a,b)=>a+b,0)/arr.length; }
function sum(arr:number[]){ return arr.reduce((a,b)=>a+b,0); }
function peakDay(d?:{d:string;t:number}[]){
    if(!d?.length) return '-';
    const max = d.reduce((m,x)=> x.t>m.t? x:m, d[0]);
    return `${max.d} (${fmtTL(max.t)})`;
}
