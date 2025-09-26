// app/dashboard/ik/anka/trips/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api, BASE } from '@/app/lib/api';

type Trip = {
    id:number; trip?:string;
    terminal_from:string; terminal_to:string;
    departure_time:string; cost:number|string;
    is_active:boolean|number; orders?:number; revenue?:number;
};
const tl=(n:any)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(Number(n||0));

export default function Page(){
    const { token } = myAppHook() as any;
    const [rows,setRows]=useState<Trip[]>([]);
    const [q,setQ]=useState('');
    const [err,setErr]=useState('');

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

    // ---- download helpers ----
    const saveBlob = async (res: Response, fallback='export.csv')=>{
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const dispo = res.headers.get('content-disposition') || '';
        const m = dispo.match(/filename="?([^"]+)"?/i);
        const name = m?.[1] || fallback;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
    };

    // 1) TÜM VERİ (backend tarafı tüm veriyi döner)
    const exportAll = async ()=>{
        const headings = ['ID','Sefer','Kalkış','Varış','Tarih','Bilet','Gelir','Aktif'];
        const rowsCsv = filtered.map(t=>[
            t.id,
            t.trip || '-',
            t.terminal_from,
            t.terminal_to,
            t.departure_time,
            Number(t.orders||0),
            String(t.revenue ?? 0),
            Number(t.is_active) ? 'Evet' : 'Hayır',
        ]);
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename:'tum.csv', headings, rows: rowsCsv }),
        });
        await saveBlob(res,'tum.csv');
    };

    // 2) EKRANDA GÖRÜNEN (filtreli) VERİ
    const exportVisible = async ()=>{
        const headings = ['ID','Sefer','Kalkış','Varış','Tarih','Bilet','Gelir','Aktif'];
        const rowsCsv = filtered.map(t=>[
            t.id,
            t.trip || '-',
            t.terminal_from,
            t.terminal_to,
            t.departure_time,
            Number(t.orders||0),
            String(t.revenue ?? 0),
            Number(t.is_active) ? 'Evet' : 'Hayır',
        ]);
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename:'seferler_gorunen.csv', headings, rows: rowsCsv }),
        });
        await saveBlob(res,'seferler_gorunen.csv');
    };

    // 3) TEK TEK SATIR (yan buton)
    const exportOne = async (t:Trip)=>{
        const headings = ['Sefer','Kalkış','Varış','Tarih','Bilet','Gelir','Aktif'];
        const row = [[
            t.trip || '-',
            t.terminal_from,
            t.terminal_to,
            t.departure_time,
            Number(t.orders||0),
            String(t.revenue ?? 0),
            Number(t.is_active) ? 'Evet' : 'Hayır',
        ]];
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename:`sefer_${t.id}.csv`, headings, rows: row }),
        });
        await saveBlob(res, `sefer_${t.id}.csv`);
    };

    if (err) return <div className="p-6 text-red-700">{err}</div>;

    return (
        <div className="space-y-4 text-indigo-900/70">
            <div className="flex items-center justify-between gap-2">
                <h1 className="text-2xl font-bold text-indigo-900">Seferler</h1>
                <div className="flex items-center gap-2">
                    <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
                    <button onClick={exportVisible} className="rounded-xl border px-3 py-2">Sayfa CSV</button>
                    <button onClick={exportAll} className="rounded-xl border px-3 py-2">Tüm CSV</button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[1000px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th >ID</th>
                        <th className="py-2">Sefer</th>
                        <th>Kalkış</th>
                        <th>Varış</th>
                        <th>Tarih</th>
                        <th>Bilet</th>
                        <th>Gelir</th>
                        <th>Aktif</th>
                        <th className="text-right">Export</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map(t=>(
                        <tr key={t.id} className="border-t">
                            <td >{t.id}</td>
                            <td className="py-2">{t.trip||'-'}</td>
                            <td>{t.terminal_from}</td>
                            <td>{t.terminal_to}</td>
                            <td>{t.departure_time}</td>
                            <td>{t.orders||0}</td>
                            <td>{tl(t.revenue)}</td>
                            <td>{Number(t.is_active)?'Evet':'Hayır'}</td>
                            <td className="text-right">
                                <button onClick={()=>exportOne(t)} className="rounded-lg border px-2 py-1">CSV</button>
                            </td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={8} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
