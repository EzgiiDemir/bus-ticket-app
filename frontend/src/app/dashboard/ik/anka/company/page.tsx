'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../../context/AppProvider';
import { api } from '@/app/lib/api';

export default function Page(){
    const { token } = myAppHook() as any;
    const [d,setD]=useState<any>(null), [err,setErr]=useState('');
    useEffect(()=>{ (async()=>{
        try{ setD(await api.json(await api.get('/company/me',{token}))); }catch(e:any){ setErr(e?.response?.data?.message||'Hata'); }
    })(); },[token]);
    if (err) return <div className="p-6 text-red-700">{err}</div>;
    if (!d) return <div className="p-6">Yükleniyor…</div>;
    return (
        <div className="space-y-4 text-indigo-900/70">
            <h1 className="text-2xl font-bold text-indigo-900">Firmam</h1>
            <div className="rounded-2xl border bg-white p-4">
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div><div className="text-indigo-900/60">Ad</div><div className="font-medium">{d?.name}</div></div>
                    <div><div className="text-indigo-900/60">Kod</div><div className="font-medium">{d?.code}</div></div>
                    <div><div className="text-indigo-900/60">Durum</div><div className="font-medium">{d?.status}</div></div>
                    <div><div className="text-indigo-900/60">Çalışan</div><div className="font-medium">{d?.personnel_count}</div></div>
                </div>
            </div>
        </div>
    );
}
