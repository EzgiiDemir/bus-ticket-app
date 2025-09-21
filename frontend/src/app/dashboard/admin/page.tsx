'use client';
import { useEffect, useState, useMemo } from 'react';
import { myAppHook } from '../../../../context/AppProvider';
import { getAdminOverview, getRevenueSeries, getCompanyBreakdown, getTopRoutes } from '../../../lib/adminApi';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import { fmtTR } from '../../../lib/datetime';
import { exportCSV, exportJSON } from '@/app/lib/export';

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
            {/* KPI kartları + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="font-semibold text-indigo-900">Genel Özet</h2>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=>{
                                if(!totals) return;
                                exportCSV('admin_ozet', [totals], [
                                    { key:'orders', title:'Toplam Sipariş' },
                                    { key:'revenue', title:'Toplam Gelir' },
                                    { key:'active_trips', title:'Aktif Sefer' },
                                    { key:'upcoming', title:'Yaklaşan' },
                                    { key:'personnel', title:'Personel' },
                                    { key:'customers', title:'Müşteri' },
                                ]);
                            }}
                        >CSV</button>
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=> totals && exportJSON('admin_ozet', totals)}
                        >JSON</button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <Card title="Toplam Sipariş" value={totals?.orders ?? 0}/>
                    <Card title="Toplam Gelir" value={trCur(totals?.revenue ?? 0)}/>
                    <Card title="Aktif Sefer" value={totals?.active_trips ?? 0}/>
                    <Card title="Yaklaşan" value={totals?.upcoming ?? 0}/>
                    <Card title="Personel" value={totals?.personnel ?? 0}/>
                    <Card title="Müşteri" value={totals?.customers ?? 0}/>
                </div>
            </div>

            {/* Gelir grafiği + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">Gelir (Son 30 gün)</h3>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=>{
                                exportCSV('gelir_son30gun', series, [
                                    { key:'d', title:'Tarih' },
                                    { key:'revenue', title:'Gelir' },
                                ]);
                            }}
                        >CSV</button>
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=> exportJSON('gelir_son30gun', series)}
                        >JSON</button>
                    </div>
                </div>
                <div className="h-72 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="d" /><YAxis /><Tooltip /><Legend />
                            <Line type="monotone" dataKey="revenue" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Şirket kırılımı + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">Şirket Kırılımı</h3>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=>{
                                exportCSV('sirket_kirilimi', breakdown, [
                                    { key:'name', title:'Şirket' },
                                    { key:'revenue', title:'Gelir' },
                                    { key:'orders', title:'Sipariş' },
                                ]);
                            }}
                        >CSV</button>
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=> exportJSON('sirket_kirilimi', breakdown)}
                        >JSON</button>
                    </div>
                </div>
                <div className="h-72 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={breakdown}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                            <Bar dataKey="revenue" /><Bar dataKey="orders" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Güzergahlar tablosu + export */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold text-indigo-900">En Çok Satılan Güzergahlar</h3>
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=>{
                                exportCSV('en_cok_satan_guzergahlar', routes, [
                                    { key:'terminal_from', title:'Kalkış' },
                                    { key:'terminal_to', title:'Varış' },
                                    { key:'seats', title:'Koltuk' },
                                    { key:'revenue', title:'Gelir' },
                                ]);
                            }}
                        >CSV</button>
                        <button
                            className="px-3 py-1 rounded-lg border"
                            onClick={()=> exportJSON('en_cok_satan_guzergahlar', routes)}
                        >JSON</button>
                    </div>
                </div>
                <div className="overflow-x-auto mt-2">
                    <table className="min-w-[720px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Güzergah</th><th>Koltuk</th><th>Gelir</th>
                        </tr>
                        </thead>
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
            <div className="text-2xl font-bold mt-1 text-indigo-900">{value}</div>
        </div>
    );
}
