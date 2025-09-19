'use client';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

type Co = { id:number; name:string; code:string };

export default function CompanyPage() {
    const { token, isLoading } = myAppHook() as any;
    const [data, setData] = useState<Co|null>(null);
    const [err, setErr] = useState<string|null>(null);

    const getCompany = useCallback(async () => {
        const { data } = await axios.get('/personnel/company');
        return data as Co;
    }, []);

    useEffect(() => {
        if (isLoading) return;
        if (!token) { setErr('Unauthorized'); return; }
        getCompany()
            .then(setData)
            .catch((e:any) => setErr(e?.message || 'Hata'));
    }, [isLoading, token, getCompany]);

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Oturum bulunamadı. Giriş yapın.</div>;
    if (err && !data) return <div>Hata: {err}</div>;

    return (
        <div className="space-y-4 text-indigo-900/70">
            <h1 className="text-2xl font-bold text-indigo-900">Şirket</h1>
            <div className="rounded-2xl border bg-white p-4">
                {data ? (
                    <div className="space-y-1">
                        <div className="text-sm text-indigo-900/60">Ad</div>
                        <div className="text-lg font-semibold">{data.name}</div>
                        <div className="text-sm text-indigo-900/60">Kod</div>
                        <div className="font-mono">{data.code}</div>
                    </div>
                ) : 'Yükleniyor...'}
            </div>
        </div>
    );
}
