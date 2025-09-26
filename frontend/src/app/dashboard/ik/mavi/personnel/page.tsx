// app/dashboard/Company/personnel/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api, BASE } from '@/app/lib/api';

export default function CompanyPersonnel(){
    const { token } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]); const [q,setQ]=useState(''); const [err,setErr]=useState('');
    useEffect(()=>{ (async ()=>{
        try{
            const r = await api.json(await api.get('/company/personnel', { token, params:{ per_page:100 } }));
            setRows(Array.isArray(r?.data)? r.data : (r?.data?.data||r?.data||[]));
        }catch(e:any){ setErr(e?.response?.data?.message||'Liste alınamadı.'); }
    })(); },[token]);

    const filtered = rows.filter((r:any)=>{
        const s=q.trim().toLowerCase(); if(!s) return true;
        return [r.name,r.email].some(x=>String(x||'').toLowerCase().includes(s));
    });

    // CSV
    const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][])=>{
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename, headings, rows }),
        });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    };
    const exportPageCsv = async ()=>{
        await saveCsv('personnel.csv',
            ['ID','Ad','E-posta','Durum'],
            filtered.map((r:any)=>[ r.id, r.name, r.email, r.status||'-' ])
        );
    };
    const exportOneCsv = async (r:any)=>{
        await saveCsv(`person_${r.id}.csv`,
            ['ID','Ad','E-posta','Durum'],
            [[ r.id, r.name, r.email, r.status||'-' ]]
        );
    };

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    return (
        <div className="space-y-4 text-indigo-900">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Personeller</h1>
                <div className="flex items-center gap-2">
                    <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
                    <button onClick={exportPageCsv} className="rounded-xl border px-3 py-2">Sayfa CSV</button>
                </div>
            </div>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60">
                        <th className="py-2">ID</th><th className="py-2">Ad</th><th>E-posta</th><th>Durum</th><th className="text-right">CSV</th>
                    </tr></thead>
                    <tbody>
                    {filtered.map((r:any)=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.id}</td>
                            <td className="py-2">{r.name}</td>
                            <td>{r.email}</td>
                            <td>{r.status||'-'}</td>
                            <td className="text-right"><button onClick={()=>exportOneCsv(r)} className="rounded-lg border px-2 py-1">CSV</button></td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
