'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../../context/AppProvider';

/* ---------- Tipler ---------- */
type Co = { id:number; name:string; code:string };
type ApiErr = { message?: string; errors?: Record<string, string[]|string> };

/* ---------- Sayfa ---------- */
export default function CompanyPage() {
    const { token, isLoading } = (myAppHook() as any) || {};

    const [data, setData] = useState<Co|null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string>('');
    const [banner, setBanner] = useState<string>('');

    const getCompany = useCallback(async (): Promise<Co> => {
        const { data } = await axios.get<Co>('/personnel/company', {
            headers: { Accept: 'application/json' },
        });
        return data;
    }, []);

    const refresh = useCallback(async () => {
        if (!token) { setLoading(false); return; }
        setLoading(true); setErr(''); setBanner('');
        try {
            const co = await getCompany();
            setData(co);
            setBanner('Şirket bilgileri yüklendi.');
        } catch (e: any) {
            const p: ApiErr | undefined = e?.response?.data;
            setErr(p?.message || e?.message || 'Veri alınamadı.');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [getCompany, token]);

    useEffect(() => { if (!isLoading) void refresh(); }, [isLoading, refresh]);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token)    return <div className="p-6">Oturum yok. Giriş yapın.</div>;
    if (loading)   return <div className="p-6">Yükleniyor…</div>;

    return (
        <div className="space-y-4 text-indigo-900/70">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Şirket</h1>
                <button
                    onClick={refresh}
                    className="px-3 py-1 rounded-lg border"
                    aria-label="Yenile"
                >
                    Yenile
                </button>
            </div>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="rounded-2xl border bg-white p-4">
                {data ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                        <Info label="Ad"   value={data.name}/>
                        <Info label="Kod"  value={<code className="font-mono">{data.code}</code>}/>
                    </div>
                ) : (
                    <div className="text-indigo-900/50">Kayıt bulunamadı</div>
                )}
            </div>
        </div>
    );
}

/* ---------- Parçalar ---------- */
function Info({ label, value }:{ label:string; value:React.ReactNode }) {
    return (
        <div>
            <div className="text-xs text-indigo-900/60">{label}</div>
            <div className="font-semibold text-indigo-900">{value}</div>
        </div>
    );
}
