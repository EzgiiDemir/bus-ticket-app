'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listCustomers } from '../../../../lib/adminApi';
import { fmtTR } from '../../../../lib/datetime';

export default function AdminCustomers(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]);
    const [q,setQ]=useState('');
    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return; listCustomers({ q }).then(setRows); },[isLoading,token,user,q]);
    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-3 text-indigo-900/60">
            <div className="flex justify-between">
                <h1 className="text-xl font-semibold">Müşteriler</h1>
                <input className="rounded-xl border px-3 py-2" placeholder="Ara..." value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Ad</th><th>E-posta</th><th>Sipariş</th><th>Gelir</th><th>Son Sipariş</th></tr></thead>
                    <tbody>{rows.map((c,i)=>(
                        <tr key={i} className="border-t">
                            <td className="py-2">{c.passenger_name}</td><td>{c.passenger_email}</td><td>{c.orders}</td>
                            <td>{(+c.revenue||0).toFixed(2)} ₺</td><td>{fmtTR(c.last_order_at)}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    );
}
