'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listCompanies } from '../../../../lib/adminApi';

export default function AdminCompanies(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]);
    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return; listCompanies().then(setRows); },[isLoading,token,user]);
    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="rounded-2xl border bg-white p-4 overflow-x-auto text-indigo-900/60">
            <h1 className="text-xl font-semibold mb-3">Firmalar</h1>
            <table className="min-w-[800px] w-full text-sm">
                <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Ad</th><th>Kod</th><th>Sefer</th><th>Personel</th><th>Gelir</th></tr></thead>
                <tbody>{rows.map(c=>(
                    <tr key={c.id} className="border-t">
                        <td className="py-2">{c.name}</td><td>{c.code}</td><td>{c.trips}</td><td>{c.personnel}</td><td>{(+c.revenue||0).toFixed(2)} ₺</td>
                    </tr>
                ))}</tbody>
            </table>
        </div>
    );
}
