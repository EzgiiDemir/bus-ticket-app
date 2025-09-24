'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';
import { fmtTR } from '@/app/lib/datetime';

type Company = { id:number; name:string; code:string };
type User = {
    id:number; name:string; email:string; role:'passenger'|'personnel'|'admin'|string;
    role_status?: 'pending'|'active'|'rejected'|string;
    company?: Company|null; created_at?:string; updated_at?:string;
};
type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

export default function PassengerProfile() {
    const { token, isLoading, user: ctxUser } = (myAppHook() as any) || {};

    const [user, setUser] = useState<User|null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string>('');
    const [banner, setBanner] = useState<string>('');

    const refresh = async ()=>{
        if(!token) return;
        setLoading(true); setErr(''); setBanner('');
        try{
            const { data } = await axios.get<User>('/profile', { headers: { Accept:'application/json' } });
            setUser(data);
            setBanner('Profil güncellendi.');
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || 'Profil alınamadı.');
            setUser(null);
        }finally{
            setLoading(false);
        }
    };

    useEffect(()=>{ if(!isLoading && token) void refresh(); }, [isLoading, token]);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Giriş yapın.</div>;
    if (ctxUser?.role !== 'passenger') return <div className="p-6">Yetkisiz.</div>;

    if (loading) return <div className="p-6">Yükleniyor…</div>;
    if (!user)   return (
        <div className="p-6 space-y-3">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err || 'Profil bulunamadı.'}</div>
            <button className="px-3 py-2 rounded-lg border" onClick={()=>refresh()}>Yenile</button>
        </div>
    );

    const statusBadge = (s?:User['role_status'])=>{
        const base = 'inline-flex items-center rounded-lg px-2 py-0.5 text-xs border';
        if (s==='active') return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>active</span>;
        if (s==='rejected') return <span className={`${base} border-red-200 bg-red-50 text-red-700`}>rejected</span>;
        return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>{s||'pending'}</span>;
    };

    return (
        <div className="space-y-6 text-indigo-900">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Profilim</h1>
                <div className="flex gap-2">
                    <button className="px-3 py-2 rounded-lg border disabled:opacity-50" onClick={()=>refresh()} disabled={loading}>Yenile</button>
                </div>
            </div>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="rounded-2xl border bg-white p-4 space-y-3">
                <Row label="Ad Soyad" value={user.name}/>
                <Row label="E-posta" value={user.email}/>
                <Row label="Rol" value={user.role}/>
                {user.role_status && <Row label="Durum" value={statusBadge(user.role_status)} />}
                {user.company && <Row label="Şirket" value={`${user.company.name} (${user.company.code})`}/>}
                {user.created_at && <Row label="Kayıt Tarihi" value={fmtTR(user.created_at)}/>}
                {user.updated_at && <Row label="Güncelleme" value={fmtTR(user.updated_at)}/>}
            </div>
        </div>
    );
}

function Row({label,value}:{label:string;value?:any}) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b last:border-0 py-2">
            <div className="text-sm text-indigo-900/60">{label}</div>
            <div className="text-sm font-medium text-indigo-900">{value ?? '-'}</div>
        </div>
    );
}
