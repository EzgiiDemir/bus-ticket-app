'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import { exportCSV, exportJSON } from '@/app/lib/export';

type Stat = {
    orders:number;
    revenue:number;
    active_trips:number;
    upcoming_trips:number;
    daily:{ d:string; t:number }[];
};

type OrderRow = {
    id:number;
    pnr:string;
    created_at:string;
    qty:number;
    total:number;
    passenger_name?:string;
    product?: {
        trip?: string;
        terminal_from:string;
        terminal_to:string;
        departure_time:string;
        cost:number;
    };
};

const fmtTR = (iso?:string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

const fmtTL = (n:any) =>
    new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }).format(Number(n||0));

export default function Overview(){
    const [stats,setStats]=useState<Stat|null>(null);
    const [orders,setOrders]=useState<OrderRow[]>([]);
    const [loading,setLoading]=useState(true);


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
                    </div>
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
