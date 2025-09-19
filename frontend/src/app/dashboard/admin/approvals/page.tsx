'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { listApprovals, approveUser, rejectUser } from '../../../../lib/adminApi';

export default function AdminApprovals(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<any[]>([]);

    const refresh = () =>
        listApprovals()
            .then((arr)=> setRows(Array.isArray(arr) ? arr : []))
            .catch(()=> setRows([]));

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return; refresh(); },[isLoading,token,user]);

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    const hasRows = Array.isArray(rows) && rows.length>0;

    return (
        <div className="rounded-2xl border bg-white p-4 overflow-x-auto text-indigo-900/60">
            <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-semibold">Onay Bekleyen Personel</h1>
            </div>
            <table className="min-w-[900px] w-full text-sm">
                <thead>
                <tr className="text-left text-indigo-900/60">
                    <th className="py-2">Ad</th><th>E-posta</th><th>Firma</th><th>Durum</th><th>İşlem</th>
                </tr>
                </thead>
                <tbody>
                {hasRows ? rows.map((u:any)=>(
                    <tr key={u.id} className="border-t">
                        <td className="py-2">{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.company?.name ?? '-'}</td>
                        <td>{u.role_status}</td>
                        <td className="space-x-2">
                            <button className="px-2 py-1 rounded-lg border" onClick={async()=>{await approveUser(u.id); refresh();}}>Onayla</button>
                            <button className="px-2 py-1 rounded-lg border" onClick={async()=>{await rejectUser(u.id); refresh();}}>Reddet</button>
                        </td>
                    </tr>
                )) : (
                    <tr><td colSpan={5} className="text-center py-4 text-gray-500">Onay bekleyen kullanıcı yok</td></tr>
                )}
                </tbody>
            </table>
        </div>
    );
}
