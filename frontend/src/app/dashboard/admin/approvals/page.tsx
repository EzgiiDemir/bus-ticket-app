'use client';

import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listApprovals, approveUser, rejectUser } from '../../../../lib/adminApi';
import { exportCSV } from '@/app/lib/export';

type Row = {
    id:number;
    name:string;
    email:string;
    company?:{ name?:string };
    role_status?: 'pending'|'active'|'rejected'|string;
};

type ApiErr = { message?:string; errors?:Record<string,string[]|string> };

export default function AdminApprovals(){
    const { token, isLoading, user } = myAppHook() as any;

    const [rows,setRows]=useState<Row[]>([]);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10);

    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState<string>('');
    const [actingId,setActingId]=useState<number|null>(null);
    const [banner,setBanner]=useState<string>('');

    const refresh = async () => {
        setLoading(true);
        setErr('');
        setBanner('');
        try{
            const resp = await listApprovals();
            const arr = Array.isArray(resp) ? resp : (resp?.data || []);
            setRows(arr as Row[]);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            const msg = p?.message || 'Liste alınamadı.';
            setErr(msg);
        }finally{
            setLoading(false);
        }
    };

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return; void refresh(); },[isLoading,token,user]);

    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase();
        if(!t) return rows;
        return rows.filter(r =>
            [r.name, r.email, r.company?.name, r.role_status]
                .some(x=> String(x||'').toLowerCase().includes(t))
        );
    },[rows,q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages, page]);

    const paged = useMemo(()=>{
        const start = (page-1)*pageSize;
        return filtered.slice(start, start+pageSize);
    },[filtered, page, pageSize]);

    const onApprove = async (id:number) => {
        if(!confirm('Bu kullanıcıyı ONAYLA?')) return;
        setActingId(id);
        setBanner(''); setErr('');
        try{
            await approveUser(id);
            setBanner('Kullanıcı onaylandı.');
            await refresh();
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Onay işlemi başarısız.');
        }finally{
            setActingId(null);
        }
    };

    const onReject = async (id:number) => {
        if(!confirm('Bu kullanıcıyı REDDET?')) return;
        setActingId(id);
        setBanner(''); setErr('');
        try{
            await rejectUser(id);
            setBanner('Kullanıcı reddedildi.');
            await refresh();
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Reddetme işlemi başarısız.');
        }finally{
            setActingId(null);
        }
    };

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;
    if (user?.role!=='admin') return <div className="p-6">Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-indigo-900/80">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Onay Bekleyen Personel</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (ad, e-posta, firma)…"
                        value={q}
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
                        aria-label="Arama"
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={pageSize}
                        onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                        aria-label="Sayfa başına"
                    >
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>

                    <button
                        className="rounded-xl border px-3 py-2 disabled:opacity-50"
                        disabled={!filtered.length}
                        onClick={()=>{
                            exportCSV('onay_bekleyenler_tumu', filtered, [
                                { key:'name', title:'Ad' },
                                { key:'email', title:'E-posta' },
                                { key:'company', title:'Firma', map:(r:Row)=> r.company?.name || '-' },
                                { key:'role_status', title:'Durum' },
                            ]);
                        }}
                    >CSV</button>

                    <button
                        className="rounded-xl border px-3 py-2 disabled:opacity-50"
                        onClick={()=>void refresh()}
                        disabled={loading}
                    >Yenile</button>
                </div>
            </div>

            {/* Banners */}
            {banner && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {banner}
                </div>
            )}
            {err && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {err}
                </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? ((page-1)*pageSize+1) : 0}–{Math.min(page*pageSize, total)}</b> / {total} •&nbsp;
                    Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad</th>
                            <th>E-posta</th>
                            <th>Firma</th>
                            <th>Durum</th>
                            <th className="text-right">İşlem</th>
                        </tr>
                        </thead>
                        <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">Yükleniyor…</td></tr>
                        ) : paged.length ? paged.map((u)=>(
                            <tr key={u.id} className="border-t">
                                <td className="py-2">{u.name}</td>
                                <td>{u.email}</td>
                                <td>{u.company?.name ?? '-'}</td>
                                <td>
                    <span className={
                        `inline-flex items-center rounded-lg px-2 py-0.5 text-xs
                      ${u.role_status==='active'   ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            u.role_status==='rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'}`
                    }>
                      {u.role_status ?? 'pending'}
                    </span>
                                </td>
                                <td className="text-right space-x-2">
                                    <button
                                        className="px-2 py-1 rounded-lg border disabled:opacity-50"
                                        disabled={actingId===u.id}
                                        onClick={()=>onApprove(u.id)}
                                        aria-label={`Onayla ${u.name}`}
                                    >Onayla</button>
                                    <button
                                        className="px-2 py-1 rounded-lg border disabled:opacity-50"
                                        disabled={actingId===u.id}
                                        onClick={()=>onReject(u.id)}
                                        aria-label={`Reddet ${u.name}`}
                                    >Reddet</button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={5} className="text-center py-6 text-indigo-900/50">Onay bekleyen kullanıcı yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> kişi</div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page<=1}
                            onClick={()=>setPage(p=>Math.max(1,p-1))}
                            aria-label="Önceki sayfa"
                        >Önceki</button>
                        <span className="text-sm">{page} / {totalPages}</span>
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page>=totalPages}
                            onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                            aria-label="Sonraki sayfa"
                        >Sonraki</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
