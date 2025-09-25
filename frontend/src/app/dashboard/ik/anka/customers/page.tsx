// app/dashboard/ik/anka/customers/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api } from '@/app/lib/api';

const tl=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(n||0);

export default function Page(){
    const { token } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]), [q,setQ]=useState(''), [err,setErr]=useState('');
    useEffect(()=>{ (async()=>{
        try{
            const r = await api.json(await api.get('/company/customers',{ token, params:{ sort:'total_desc', per_page:100 } }));
            setRows(Array.isArray(r?.data)? r.data : (r?.data?.data||r?.data||[]));
        }catch(e:any){ setErr(e?.response?.data?.message||'Liste alınamadı.'); }
    })(); },[token]);

    const filtered = rows.filter((r:any)=>{
        const s=q.trim().toLowerCase(); if(!s) return true;
        return [r.name,r.email].some(x=>String(x||'').toLowerCase().includes(s));
    });

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Müşteriler</h1>
                <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[800px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Ad</th><th>E-posta</th><th>Toplam</th><th>Sipariş</th></tr></thead>
                    <tbody>
                    {filtered.map((r:any)=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.name||'-'}</td>
                            <td>{r.email||'-'}</td>
                            <td>{tl(Number(r.total||0))}</td>
                            <td>{r.orders||0}</td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={4} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
