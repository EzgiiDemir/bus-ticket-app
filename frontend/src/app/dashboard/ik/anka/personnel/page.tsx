// app/dashboard/ik/anka/personnel/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api, BASE } from '@/app/lib/api';

export default function Page(){
    const { token } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]), [q,setQ]=useState(''), [err,setErr]=useState('');

    useEffect(()=>{ (async()=>{
        try{
            const r = await api.json(await api.get('/company/personnel',{ token, params:{ per_page:100 } }));
            setRows(Array.isArray(r?.data)? r.data : (r?.data?.data||r?.data||[]));
        }catch(e:any){ setErr(e?.response?.data?.message||'Liste alınamadı.'); }
    })(); },[token]);

    const filtered = rows.filter((r:any)=>{
        const s=q.trim().toLowerCase(); if(!s) return true;
        return [r.name,r.email].some(x=>String(x||'').toLowerCase().includes(s));
    });

    // --- CSV yardımcıları ---
    const saveCsv = async (filename:string, headings:string[], rows:(string|number)[][])=>{
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename, headings, rows }),
        });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
    };

    const exportVisible = async ()=>{
        const headings = ['ID','Ad','E-posta','Durum'];
        const rowsCsv = filtered.map((r:any)=>[
            r.id ?? '', r.name ?? '-', r.email ?? '-', r.status ?? '-'
        ]);
        await saveCsv('personeller.csv', headings, rowsCsv);
    };
  const exportAll = async ()=>{
        const headings = ['ID','Ad','E-posta','Durum'];
        const rowsCsv = filtered.map((r:any)=>[
            r.id ?? '', r.name ?? '-', r.email ?? '-', r.status ?? '-'
        ]);
        await saveCsv('tum.csv', headings, rowsCsv);
    };

    const exportOne = async (r:any)=>{
        const headings = ['ID','Ad','E-posta','Durum'];
        const row = [[ r.id ?? '', r.name ?? '-', r.email ?? '-', r.status ?? '-' ]];
        await saveCsv(`personel_${r.id}.csv`, headings, row);
    };
    // --- CSV son ---

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    return (
        <div className="space-y-4 text-indigo-900/70">
            <div className="flex items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-indigo-900">Personeller</h1>
                <div className="flex gap-2">
                    <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
                    <button onClick={exportVisible} className="rounded-xl border px-3 py-2">Sayfa CSV</button>
                    <button onClick={exportAll} className="rounded-xl border px-3 py-2">Tüm CSV</button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">ID</th>
                        <th className="py-2">Ad</th>
                        <th>E-posta</th>
                        <th>Durum</th>
                        <th className="text-right">Export</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map((r:any)=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.id}</td>
                            <td className="py-2">{r.name}</td>
                            <td>{r.email}</td>
                            <td>{r.status||'-'}</td>
                            <td className="text-right">
                                <button onClick={()=>exportOne(r)} className="rounded-lg border px-2 py-1">CSV</button>
                            </td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
