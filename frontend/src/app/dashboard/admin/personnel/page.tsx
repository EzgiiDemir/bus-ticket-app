'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listPersonnel } from '../../../../lib/adminApi';

export default function AdminPersonnel(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]);
    const [q,setQ]=useState('');

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
        listPersonnel({ q }).then(setRows).catch(()=>{});
    },[isLoading,token,user,q]);

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-3 text-indigo-900/60">
            <div className="flex justify-between">
                <h1 className="text-xl font-semibold">Personel</h1>
                <input className="rounded-xl border px-3 py-2" placeholder="Ara..." value={q} onChange={e=>setQ(e.target.value)}/>
            </div>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Ad</th><th>E-posta</th><th>Firma</th><th>Durum</th><th>Sefer</th><th>Koltuk</th><th>Gelir</th></tr></thead>
                    <tbody>
                    {rows.map(p=>(
                        <tr key={p.id} className="border-t">
                            <td className="py-2">{p.name}</td><td>{p.email}</td><td>{p.company?.name ?? '-'}</td>
                            <td>{p.role_status}</td><td>{p.trips}</td><td>{p.seats}</td><td>{(+p.revenue||0).toFixed(2)} ₺</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
