// app/dashboard/ik/anka/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api, BASE } from '@/app/lib/api';

type Stats = { revenue_30d:number; orders_30d:number; active_trips:number; personnel_count:number };
type Trip  = { id:number; trip?:string; terminal_from?:string; terminal_to?:string; departure_time?:string; orders?:number; revenue?:number; is_active?:boolean|number };
type Cust  = { id:number; name?:string; email?:string; orders?:number; total?:number };
type Approval = {
    id:number;
    company_status:'pending'|'approved'|'rejected';
    admin_status:'pending'|'approved'|'rejected';
    user?:{ id:number; name?:string; email?:string };
    created_at:string;
};

const tl  = (n:number)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:0}).format(n||0);
const fmt = (s?:string)=> s ? new Date(s).toLocaleString('tr-TR') : '-';

export default function Page(){
    const { token } = myAppHook() as any;

    const [stats,setStats]=useState<Stats|null>(null);
    const [trips,setTrips]=useState<Trip[]>([]);
    const [custs,setCusts]=useState<Cust[]>([]);
    const [apprs,setApprs]=useState<Approval[]>([]);
    const [err,setErr]=useState('');
    const [loading,setLoading]=useState(true);

    useEffect(()=>{ (async()=>{
        if(!token) return;
        setLoading(true); setErr('');
        try{
            const [sRes,tRes,cRes,aRes] = await Promise.all([
                api.get('/company/stats',{token}),
                api.get('/company/trips',{ token, params:{ per_page:20 }}),
                api.get('/company/customers',{ token, params:{ per_page:10, sort:'total_desc' }}),
                api.get('/company/approvals',{ token, params:{ per_page:10 }}),
            ]);
            const s = await api.json<Stats>(sRes);
            const t = await api.json<any>(tRes);
            const c = await api.json<any>(cRes);
            const a = await api.json<any>(aRes);

            setStats(s || null);
            setTrips(Array.isArray(t?.data)? t.data : (t?.data?.data||t?.data||[]));
            setCusts(Array.isArray(c?.data)? c.data : (c?.data?.data||c?.data||[]));
            setApprs(Array.isArray(a?.data)? a.data : (a?.data?.data||a?.data||[]));
        }catch(e:any){
            setErr(e?.response?.data?.message || e?.message || 'Hata');
        }finally{
            setLoading(false);
        }
    })(); },[token]);

    const upcoming = useMemo(()=>{
        const now = Date.now();
        return [...trips]
            .filter(t=> !t.departure_time || new Date(t.departure_time).getTime()>=now)
            .sort((a,b)=> new Date(a.departure_time||0).getTime() - new Date(b.departure_time||0).getTime())
            .slice(0,8);
    },[trips]);

    const pendingApprs = useMemo(()=> apprs.filter(x=>x.company_status==='pending').slice(0,8), [apprs]);

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    if (loading || !stats) return <div className="p-6">Yükleniyor…</div>;

    // ---- SADECE CSV EKLERI ----
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

    const exportTrips = async ()=>{
        const headings = ['ID','Sefer','Kalkış','Varış','Tarih','Satış','Gelir','Aktif'];
        const rows = upcoming.map(t=>[
            t.id||'-', t.trip||'-', t.terminal_from||'-', t.terminal_to||'-',
            fmt(t.departure_time), t.orders??0, String(t.revenue??0),
            Number(t.is_active)?'Evet':'Hayır'
        ]);
        await saveCsv('yaklasan_seferler.csv', headings, rows);
    };

    const exportCusts = async ()=>{
        const headings = ['ID','Ad','E-posta','Sipariş','Toplam'];
        const rows = custs.map(c=>[
            c.id||'-',  c.name||'-', c.email||'-', c.orders??0, String(c.total??0)
        ]);
        await saveCsv('musteriler.csv', headings, rows);
    };

    const exportApprs = async ()=>{
        const headings = ['ID','Ad','E-posta','Firma Onayı','Admin Onayı','Başvuru'];
        const rows = pendingApprs.map(r=>[
            r.id||'-',  r.user?.name||'-', r.user?.email||'-', r.company_status, r.admin_status, fmt(r.created_at)
        ]);
        await saveCsv('bekleyen_onaylar.csv', headings, rows);
    };
    // ---- CSV EKLERI BITTI ----

    return (
        <div className="space-y-6 text-indigo-900">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Anka • Genel Bakış</h1>
            </div>

            {/* KPI’lar */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KPI title="Son 30 Gün Gelir" value={tl(stats.revenue_30d||0)} sub="TRY" />
                <KPI title="Son 30 Gün Sipariş" value={String(stats.orders_30d||0)} />
                <KPI title="Aktif Sefer" value={String(stats.active_trips||0)} />
                <KPI title="Personel" value={String(stats.personnel_count||0)} />
            </div>

            {/* 2 sütun içerik */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Yaklaşan seferler */}
                <section className="rounded-2xl border bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="font-semibold">Yaklaşan Seferler</h2>
                        <button onClick={exportTrips} className="rounded-xl border px-3 py-1 text-sm">CSV</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[800px] w-full text-sm">
                            <thead>
                            <tr className="text-left text-indigo-900/60">
                                <th className={'px-1'}>ID</th>
                                <th >Sefer</th>
                                <th>Kalkış</th>
                                <th>Varış</th>
                                <th>Tarih</th>
                                <th>Satış</th>
                                <th>Gelir</th>
                                <th>Aktif</th>
                            </tr>
                            </thead>
                            <tbody>
                            {upcoming.map(t=>(
                                <tr key={t.id} className="border-t">
                                    <td className="py-2">{t.id || '-'}</td>
                                    <td className="py-2">{t.trip || '-'}</td>
                                    <td>{t.terminal_from || '-'}</td>
                                    <td>{t.terminal_to || '-'}</td>
                                    <td>{fmt(t.departure_time)}</td>
                                    <td>{t.orders ?? 0}</td>
                                    <td>{tl(Number(t.revenue||0))}</td>
                                    <td>{Number(t.is_active)?'Evet':'Hayır'}</td>
                                </tr>
                            ))}
                            {!upcoming.length && <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* En iyi müşteriler */}
                <section className="rounded-2xl border bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="font-semibold">En İyi Müşteriler</h2>
                        <button onClick={exportCusts} className="rounded-xl border px-3 py-1 text-sm">CSV</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[700px] w-full text-sm">
                            <thead>
                            <tr className="text-left text-indigo-900/60">
                                <th className="py-2">ID</th>
                                <th className="py-2">Ad</th>
                                <th>E-posta</th>
                                <th>Sipariş</th>
                                <th>Toplam</th>
                            </tr>
                            </thead>
                            <tbody>
                            {custs.slice(0,8).map(c=>(
                                <tr key={c.id} className="border-t">
                                    <td className="py-2">{c.id || '-'}</td>
                                    <td className="py-2">{c.name || '-'}</td>
                                    <td>{c.email || '-'}</td>
                                    <td>{c.orders ?? 0}</td>
                                    <td className="font-medium">{tl(Number(c.total||0))}</td>
                                </tr>
                            ))}
                            {!custs.length && <tr><td colSpan={4} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Bekleyen onaylar */}
                <section className="rounded-2xl border bg-white p-4 lg:col-span-2">
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="font-semibold">Bekleyen Personel Onayları</h2>
                        <button onClick={exportApprs} className="rounded-xl border px-3 py-1 text-sm">CSV</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[800px] w-full text-sm">
                            <thead>
                            <tr className="text-left text-indigo-900/60">
                                <th className="py-2">ID</th>
                                <th className="py-2">Ad</th>
                                <th>E-posta</th>
                                <th>Firma Onayı</th>
                                <th>Admin Onayı</th>
                                <th>Başvuru</th>
                            </tr>
                            </thead>
                            <tbody>
                            {pendingApprs.map(r=>(
                                <tr key={r.id} className="border-t">
                                    <td className="py-2">{r.user?.id || '-'}</td>
                                    <td className="py-2">{r.user?.name || '-'}</td>
                                    <td>{r.user?.email || '-'}</td>
                                    <td>{r.company_status}</td>
                                    <td>{r.admin_status}</td>
                                    <td>{fmt(r.created_at)}</td>
                                </tr>
                            ))}
                            {!pendingApprs.length && <tr><td colSpan={5} className="py-6 text-center text-indigo-900/50">Bekleyen onay yok</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}

function KPI({title, value, sub}:{title:string; value:string; sub?:string}){
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-indigo-900/60 text-sm">{title}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
            {sub ? <div className="text-xs text-indigo-900/50 mt-0.5">{sub}</div> : null}
        </div>
    );
}
