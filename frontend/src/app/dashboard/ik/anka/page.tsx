// app/dashboard/ik/anka/page.tsx  (Dashboard)
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api } from '@/app/lib/api';

type Stats = { revenue_30d:number; orders_30d:number; active_trips:number; personnel_count:number };
const tl = (n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(n||0);

export default function Page(){
    const { token } = myAppHook() as any;
    const [s,setS]=useState<Stats|null>(null); const [err,setErr]=useState('');

    useEffect(()=>{ (async()=>{
        try{
            const res = await api.get('/company/stats',{token});
            setS(await api.json(res));
        }catch(e:any){
            setErr(e?.message || 'Hata');
        }
    })(); },[token]);

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    if (!s) return <div className="p-6">Yükleniyor…</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-indigo-900">Anka • Genel Bakış</h1>
        </div>
    );
}
