'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../context/AppProvider';
import { getAdminOverview, getRevenueSeries, getCompanyBreakdown, getTopRoutes } from '../../../lib/adminApi';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { fmtTR } from '../../../lib/datetime';

type Totals = { orders:number; revenue:number; active_trips:number; upcoming:number; personnel:number; customers:number };

export default function AdminOverviewPage(){
    const { token, isLoading, user } = myAppHook() as any;
    const [totals,setTotals]=useState<Totals|null>(null);
    const [series,setSeries]=useState<any[]>([]);
    const [breakdown,setBreakdown]=useState<any[]>([]);
    const [routes,setRoutes]=useState<any[]>([]);

    const toNum=(v:any)=>Number((typeof v==='string'?v.replace(',','.') : v) ?? 0)||0;
    const trCur=(v:any)=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(toNum(v));

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
        getAdminOverview().then(setTotals);
        getRevenueSeries(30).then(d=>setSeries((d||[]).map((x:any)=>({...x,revenue:toNum(x.revenue)}))));
        getCompanyBreakdown().then(d=>setBreakdown((d||[]).map((x:any)=>({...x,revenue:toNum(x.revenue),orders:toNum(x.orders)}))));
        getTopRoutes().then(d=>setRoutes((d||[]).map((x:any)=>({...x,revenue:toNum(x.revenue),seats:toNum(x.seats)}))));
    },[isLoading,token,user]);

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-6 text-indigo-900/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <Card title="Toplam Sipariş" value={totals?.orders ?? 0}/>
                <Card title="Toplam Gelir" value={trCur(totals?.revenue ?? 0)}/>
                <Card title="Aktif Sefer" value={totals?.active_trips ?? 0}/>
                <Card title="Yaklaşan" value={totals?.upcoming ?? 0}/>
                <Card title="Personel" value={totals?.personnel ?? 0}/>
                <Card title="Müşteri" value={totals?.customers ?? 0}/>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl border bg-white p-4 xl:col-span-2">
                    <h3 className="font-semibold mb-3">Gelir (Son 30 gün)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={series}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="d" /><YAxis /><Tooltip /><Legend />
                                <Line type="monotone" dataKey="revenue" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                    <h3 className="font-semibold mb-3">Şirket Kırılımı</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={breakdown}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                                <Bar dataKey="revenue" /><Bar dataKey="orders" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <h3 className="font-semibold mb-3">En Çok Satılan Güzergahlar</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-[800px] w-full text-sm">
                        <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Güzergah</th><th>Koltuk</th><th>Gelir</th></tr></thead>
                        <tbody>
                        {(routes||[]).map((r:any,i:number)=>(
                            <tr key={i} className="border-t">
                                <td className="py-2">{r.terminal_from} → {r.terminal_to}</td>
                                <td>{r.seats}</td>
                                <td>{trCur(r.revenue)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Card({title,value}:{title:string;value:any}){
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-sm text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
    );
}
