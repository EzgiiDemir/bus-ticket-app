// app/dashboard/admin/approvals/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api } from '@/app/lib/api';
import { BASE } from '@/app/lib/api';

/* ---------- Tipler ---------- */
type Row = {
    id:number;
    role:string;
    company_status:'pending'|'approved'|'rejected';
    admin_status:'pending'|'approved'|'rejected';
    company?:{ name?:string };
    user?:{ id:number; name?:string; email?:string };
    created_at:string;
};
type ApiErr = { message?:string; errors?:Record<string,string[]|string> };

/* ---------- CSV helpers (sunucu→istemci fallback) ---------- */
const csvEscape=(v:any)=>{const s=String(v??'');return /[\";\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
const buildCsv=(h:string[], rows:(string|number)[][])=>'\uFEFF'+(h.length?h.map(csvEscape).join(';')+'\n':'')+rows.map(r=>r.map(csvEscape).join(';')).join('\n');
const downloadText=(fn:string,txt:string)=>{const b=new Blob([txt],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);};
const saveCsv=async(fn:string,h:string[],rows:(string|number)[][],token?:string)=>{
    try{
        const res=await fetch(`${BASE}/company/export/array`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({filename:fn,headings:h,rows})});
        if(!res.ok) throw new Error();
        const blob=await res.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    }catch{ downloadText(fn, buildCsv(h, rows)); }
};

export default function AdminApprovals(){
    const { token, isLoading, user } = myAppHook() as any;

    const [rows,setRows]=useState<Row[]>([]);
    const [q,setQ]=useState(''); const [loading,setLoading]=useState(false);
    const [err,setErr]=useState(''); const [banner,setBanner]=useState('');

    /* Listeyi çek */
    const fetchRows = async ()=>{
        setLoading(true); setErr(''); setBanner('');
        try{
            const res = await api.get('/admin/approvals', { token, params:{ per_page:100 } });
            const data = await api.json<any>(res);
            const arr:Row[] = Array.isArray(data?.data) ? data.data : (data?.data?.data || data?.data || []);
            setRows(arr);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Liste alınamadı.');
        }finally{ setLoading(false); }
    };
    useEffect(()=>{ if(!isLoading && token && user?.role==='admin') fetchRows(); },[isLoading,token,user]);

    /* Filtre */
    const filtered = useMemo(()=>{
        const s = q.trim().toLowerCase();
        if(!s) return rows;
        return rows.filter(r =>
            [r.user?.name,r.user?.email,r.company?.name,r.company_status,r.admin_status]
                .some(x=> String(x||'').toLowerCase().includes(s))
        );
    },[rows,q]);

    const badge = (v:string)=>(
        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs border ${
            v==='approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                v==='rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
        }`}>{v}</span>
    );

    /* İşlem */
    const act = async (id:number, kind:'approve'|'reject')=>{
        setErr(''); setBanner('');
        try{
            await api.post(`/admin/approvals/${id}/${kind}`, {}, { token });
            setBanner(kind==='approve'?'Onaylandı.':'Reddedildi.');
            await fetchRows();
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'İşlem hatası');
        }
    };

    /* CSV */
    const headers=['ID','Ad','E-posta','Firma','Firma Onayı','Admin Onayı','Rol','Başvuru'];
    const rowToCsv=(r:Row):(number | string | string | "pending" | "approved" | "rejected")[]=>[
        (r.user?.id ?? '-'), (r.user?.name||'-'), (r.user?.email||'-'), (r.company?.name||'-'),
        r.company_status, r.admin_status, r.role, r.created_at
    ];
    const exportPageCsv=()=> saveCsv('admin_onaylar_sayfa.csv', headers, filtered.map(rowToCsv) as any, token);
    const exportOneCsv =(r:Row)=> saveCsv(`onay_${r.id}.csv`, headers, [rowToCsv(r)] as any, token);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (user?.role!=='admin') return <div className="p-6">Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-black">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold">Admin Onayları</h1>
                <div className="flex gap-2">
                    <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
                    <button className="rounded-xl border px-3 py-2" onClick={exportPageCsv} disabled={loading}>Sayfa CSV</button>
                    <button className="rounded-xl border px-3 py-2" onClick={fetchRows} disabled={loading}>Yenile</button>
                </div>
            </div>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">ID</th>
                        <th className="py-2">Ad</th>
                        <th>E-posta</th>
                        <th>Firma</th>
                        <th>Firma Onayı</th>
                        <th>Admin Onayı</th>
                        <th>Rol</th>
                        <th className="text-right">İşlem</th>
                        <th className="text-right">CSV</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map(r=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.user?.id ?? '-'}</td>
                            <td className="py-2">{r.user?.name}</td>
                            <td>{r.user?.email}</td>
                            <td>{r.company?.name || '-'}</td>
                            <td>{badge(r.company_status)}</td>
                            <td>{badge(r.admin_status)}</td>
                            <td>{r.role}</td>
                            <td className="text-right space-x-2">
                                <button className="px-2 py-1 rounded-lg border disabled:opacity-50" disabled={r.company_status!=='approved' || r.admin_status!=='pending'} onClick={()=>act(r.id,'approve')}>Onayla</button>
                                <button className="px-2 py-1 rounded-lg border disabled:opacity-50" disabled={r.admin_status!=='pending'} onClick={()=>act(r.id,'reject')}>Reddet</button>
                            </td>
                            <td className="text-right">
                                <button className="px-2 py-1 rounded-lg border" onClick={()=>exportOneCsv(r)}>CSV</button>
                            </td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={9} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
