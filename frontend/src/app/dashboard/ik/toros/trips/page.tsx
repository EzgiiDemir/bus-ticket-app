// app/dashboard/ik/toros/trips/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api } from '@/app/lib/api';

type Trip = { id:number; trip?:string; terminal_from:string; terminal_to:string; departure_time:string; cost:number|string; is_active:boolean|number; orders?:number; revenue?:number; };
const tl=(n:any)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(n||0));

export default function Page(){
    const { token } = myAppHook() as any;
    const [rows,setRows]=useState<Trip[]>([]), [q,setQ]=useState(''), [err,setErr]=useState('');
    useEffect(()=>{ (async()=>{
        try{
            const r = await api.json(await api.get('/company/trips',{ token, params:{ per_page:100 } }));
            setRows(Array.isArray(r?.data)? r.data : (r?.data?.data||r?.data||[]));
        }catch(e:any){ setErr(e?.response?.data?.message||'Liste alınamadı.'); }
    })(); },[token]);

    const filtered = rows.filter(t=>{
        const s=q.trim().toLowerCase(); if(!s) return true;
        return [t.trip,t.terminal_from,t.terminal_to].some(x=>String(x||'').toLowerCase().includes(s));
    });

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60">
                        <th className="py-2">Sefer</th><th>Kalkış</th><th>Varış</th><th>Tarih</th><th>Bilet</th><th>Gelir</th><th>Aktif</th>
                    </tr></thead>
                    <tbody>
                    {filtered.map(t=>(
                        <tr key={t.id} className="border-t">
                            <td className="py-2">{t.trip||'-'}</td>
                            <td>{t.terminal_from}</td>
                            <td>{t.terminal_to}</td>
                            <td>{t.departure_time}</td>
                            <td>{t.orders||0}</td>
                            <td>{tl(t.revenue)}</td>
                            <td>{Number(t.is_active)?'Evet':'Hayır'}</td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
