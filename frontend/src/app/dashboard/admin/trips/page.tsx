'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listTrips } from '../../../../lib/adminApi';
import { fmtTR } from '../../../../lib/datetime';

export default function AdminTrips(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]);
    const [q,setQ]=useState('');
    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return; listTrips({ q }).then(setRows); },[isLoading,token,user,q]);
    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-3 text-indigo-900/60">
            <div className="flex justify-between">
                <h1 className="text-xl font-semibold">Seferler</h1>
                <input className="rounded-xl border px-3 py-2" placeholder="Ara..." value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[1100px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60">
                        <th className="py-2">Sefer</th><th>Firma</th><th>Güzergah</th><th>Kalkış</th><th>Ücret</th><th>Kapasite</th><th>Aktif</th><th>Sipariş</th><th>Koltuk</th><th>Gelir</th>
                    </tr></thead>
                    <tbody>{rows.map(t=>(
                        <tr key={t.id} className="border-t">
                            <td className="py-2">{t.trip}</td><td>{t.company_name || t.company?.name}</td>
                            <td>{t.terminal_from} → {t.terminal_to}</td><td>{fmtTR(t.departure_time)}</td>
                            <td>{+t.cost || 0}</td><td>{t.capacity_reservation}</td><td>{t.is_active?'Evet':'Hayır'}</td>
                            <td>{t.orders}</td><td>{t.seats}</td><td>{(+t.revenue||0).toFixed(2)} ₺</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    );
}
