'use client';

import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api } from '@/app/lib/api';

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

export default function AdminApprovals(){
    const { token, isLoading, user } = myAppHook() as any;

    const [rows,setRows]=useState<Row[]>([]);
    const [q,setQ]=useState('');
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState('');
    const [banner,setBanner]=useState('');

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

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (user?.role!=='admin') return <div className="p-6">Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-black">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold">Admin Onayları</h1>
                <div className="flex gap-2">
                    <input className="w-64 rounded-xl border px-3 py-2" placeholder="Ara" value={q} onChange={e=>setQ(e.target.value)} />
                    <button className="rounded-xl border px-3 py-2" onClick={fetchRows} disabled={loading}>Yenile</button>
                </div>
            </div>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">Ad</th>
                        <th>E-posta</th>
                        <th>Firma</th>
                        <th>Firma Onayı</th>
                        <th>Admin Onayı</th>
                        <th className="text-right">İşlem</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map(r=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2">{r.user?.name}</td>
                            <td>{r.user?.email}</td>
                            <td>{r.company?.name || '-'}</td>
                            <td>{badge(r.company_status)}</td>
                            <td>{badge(r.admin_status)}</td>
                            <td className="text-right space-x-2">
                                <button
                                    className="px-2 py-1 rounded-lg border disabled:opacity-50"
                                    disabled={r.company_status!=='approved' || r.admin_status!=='pending'}
                                    onClick={()=>act(r.id,'approve')}
                                >Onayla</button>
                                <button
                                    className="px-2 py-1 rounded-lg border disabled:opacity-50"
                                    disabled={r.admin_status!=='pending'}
                                    onClick={()=>act(r.id,'reject')}
                                >Reddet</button>
                            </td>
                        </tr>
                    ))}
                    {!filtered.length && <tr><td colSpan={6} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
