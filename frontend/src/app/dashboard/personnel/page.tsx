'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';


type Stat = { orders:number; revenue:number; active_trips:number; upcoming_trips:number; daily:{d:string;t:number}[] };


export default function Overview(){
    const [data,setData]=useState<Stat|null>(null);
    useEffect(()=>{ axios.get('/personnel/stats').then(r=>setData(r.data)); },[]);
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>
            <div className="grid md:grid-cols-4 gap-3">
                <Card title="Sipariş" value={data?.orders ?? 0}/>
                <Card title="Gelir" value={(data?.revenue ?? 0).toFixed(2)+' ₺'}/>
                <Card title="Aktif Sefer" value={data?.active_trips ?? 0}/>
                <Card title="Yaklaşan" value={data?.upcoming_trips ?? 0}/>
            </div>
            <div className="rounded-2xl border bg-white p-4">
                <h2 className="font-semibold mb-2">Son 7 Gün Gelir</h2>
                <ul className="text-sm text-indigo-900/70">
                    {data?.daily?.map(x=> (
                        <li key={x.d} className="flex justify-between border-b last:border-0 py-1"><span>{x.d}</span><span>{x.t} ₺</span></li>
                    ))}
                </ul>
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