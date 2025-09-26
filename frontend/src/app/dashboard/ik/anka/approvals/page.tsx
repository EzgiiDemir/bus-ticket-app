// app/dashboard/ik/anka/approvals/page.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api, BASE } from '@/app/lib/api'; // <-- BASE eklendi

type Row = {
    id:number;
    company_status:'pending'|'approved'|'rejected';
    admin_status:'pending'|'approved'|'rejected';
    user?:{ id:number; name?:string; email?:string };
    company?:{ name?:string };
    created_at:string;
};

export default function Page(){
    const { token } = myAppHook() as any;
    const [rows,setRows]=useState<Row[]>([]), [q,setQ]=useState(''), [loading,setLoading]=useState(false);
    const [err,setErr]=useState(''), [banner,setBanner]=useState('');

    const fetchRows = async ()=>{
        setLoading(true); setErr(''); setBanner('');
        try{
            const res = await api.get('/company/approvals', { token, params:{ per_page:100 } });
            const data = await api.json<any>(res);
            setRows(Array.isArray(data?.data)? data.data : (data?.data?.data||data?.data||[]));
        }catch(e:any){ setErr(e?.response?.data?.message||'Liste alınamadı.'); }
        finally{ setLoading(false); }
    };
    useEffect(()=>{ if(token) fetchRows(); },[token]);

    const filtered = useMemo(()=>{
        const s=q.trim().toLowerCase(); if(!s) return rows;
        return rows.filter(r=>[r.user?.name,r.user?.email].some(x=>String(x||'').toLowerCase().includes(s)));
    },[rows,q]);

    const act = async (id:number,kind:'approve'|'reject')=>{
        setErr(''); setBanner('');
        try{
            await api.post(`/company/approvals/${id}/${kind}`,{}, { token });
            setBanner(kind==='approve'?'Firma onayı verildi.':'Firma reddetti.');
            await fetchRows();
        }catch(e:any){ setErr(e?.response?.data?.message||'İşlem hatası'); }
    };

    // --- CSV helpers (yalnızca eklendi) ---
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
        const headings = ['ID','Ad','E-posta','Firma','Firma Onayı','Admin Onayı','Başvuru'];
        const rowsCsv = filtered.map(r=>[
            r.user?.id ?? '', r.user?.name ?? '-', r.user?.email ?? '-',
            r.company?.name ?? '-', r.company_status, r.admin_status, r.created_at
        ]);
        await saveCsv('personel_onaylari.csv', headings, rowsCsv);
    };
    const exportAll = async ()=>{
        const headings = ['ID','Ad','E-posta','Firma','Firma Onayı','Admin Onayı','Başvuru'];
        const rowsCsv = filtered.map(r=>[
            r.user?.id ?? '', r.user?.name ?? '-', r.user?.email ?? '-',
            r.company?.name ?? '-', r.company_status, r.admin_status, r.created_at
        ]);
        await saveCsv('tum.csv', headings, rowsCsv);
    };

    const exportOne = async (r:Row)=>{
        const headings = ['ID','Ad','E-posta','Firma','Firma Onayı','Admin Onayı','Başvuru'];
        const row = [[
            r.user?.id ?? '', r.user?.name ?? '-', r.user?.email ?? '-',
            r.company?.name ?? '-', r.company_status, r.admin_status, r.created_at
        ]];
        await saveCsv(`onay_${r.id}.csv`, headings, row);
    };
    // --- CSV helpers son ---

    return (
        <div className="space-y-4 text-indigo-900/70">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Personel Onayları</h1>
                <div className="flex gap-2">
                    <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
                    <button className="rounded-xl border px-3 py-2" onClick={fetchRows} disabled={loading}>Yenile</button>
                    <button className="rounded-xl border px-3 py-2" onClick={exportVisible}>Sayfa CSV</button>{/* <-- eklendi */}
                    <button className="rounded-xl border px-3 py-2" onClick={exportAll}>Tüm CSV</button>{/* <-- eklendi */}
                </div>
            </div>
            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[800px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60">
                        <th className="py-2">ID</th><th className="py-2">Ad</th><th>E-posta</th><th>Firma</th><th>Firma Onayı</th><th>Admin Onayı</th><th className="text-right">İşlem</th>
                    </tr></thead>
                    <tbody>
                    {filtered.map(r=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.user?.id}</td>
                            <td className="py-2">{r.user?.name}</td>
                            <td>{r.user?.email}</td>
                            <td>{r.company?.name||'-'}</td>
                            <td>
                <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs border ${
                    r.company_status==='approved'?'bg-emerald-50 text-emerald-700 border-emerald-200':
                        r.company_status==='rejected'?'bg-red-50 text-red-700 border-red-200':
                            'bg-amber-50 text-amber-700 border-amber-200'
                }`}>{r.company_status}</span>
                            </td>
                            <td>{r.admin_status}</td>
                            <td className="text-right space-x-2">
                                <button className="px-2 py-1 rounded-lg border disabled:opacity-50" disabled={r.company_status!=='pending'} onClick={()=>act(r.id,'approve')}>Onayla</button>
                                <button className="px-2 py-1 rounded-lg border disabled:opacity-50" disabled={r.company_status!=='pending'} onClick={()=>act(r.id,'reject')}>Reddet</button>
                                <button className="px-2 py-1 rounded-lg border" onClick={()=>exportOne(r)}>CSV</button>{/* <-- satır CSV */}
                            </td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
