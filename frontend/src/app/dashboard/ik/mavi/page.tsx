// app/dashboard/Company/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api } from '@/app/lib/api';

type Stats = {
    revenue_30d: number;
    orders_30d: number;
    top_customer?: { name: string; total: number } | null;
    active_trips: number;
    personnel_count: number;
};

export default function CompanyHome() {
    const { token } = myAppHook() as any;
    const [stats, setStats] = useState<Stats | null>(null);
    const [topCustomers, setTopCustomers] = useState<any[]>([]);
    const [topPersonnel, setTopPersonnel] = useState<any[]>([]);
    const [err, setErr] = useState('');

    useEffect(() => {
        const run = async () => {
            try {
                const s = await api.json(await api.get('/company/stats', { token })); // şirket-scope endpoint
                setStats(s);
                const c = await api.json(await api.get('/company/customers', { token, params: { sort: 'total_desc', per_page: 5 } }));
                setTopCustomers(Array.isArray(c?.data) ? c.data : c);
                const p = await api.json(await api.get('/company/personnel', { token, params: { per_page: 5 } }));
                setTopPersonnel(Array.isArray(p?.data) ? p.data : p);
            } catch (e: any) {
                setErr(e?.response?.data?.message || 'Veri alınamadı.');
            }
        };
        if (token) run();
    }, [token]);

    if (err) return <div className="p-6 text-red-700">{err}</div>;
    if (!stats) return <div className="p-6">Yükleniyor…</div>;

    const tl = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border bg-white p-4">
                    <div className="font-semibold text-indigo-900 mb-2">En Çok Alışveriş Yapan Müşteriler</div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[500px] w-full text-sm">
                            <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Müşteri</th><th>Toplam</th></tr></thead>
                            <tbody>
                            {topCustomers.map((r:any)=>(
                                <tr key={r.id} className="border-t">
                                    <td className="py-2">{r.name || r.email}</td>
                                    <td>{tl(Number(r.total||0))}</td>
                                </tr>
                            ))}
                            {!topCustomers.length && <tr><td colSpan={2} className="py-4 text-indigo-900/50 text-center">Kayıt yok</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                    <div className="font-semibold text-indigo-900 mb-2">Personeller</div>
                    <div className="overflow-x-auto">
                        <table className="min-w-[500px] w-full text-sm">
                            <thead><tr className="text-left text-indigo-900/60"><th className="py-2">Ad</th><th>E-posta</th></tr></thead>
                            <tbody>
                            {topPersonnel.map((r:any)=>(
                                <tr key={r.id} className="border-t">
                                    <td className="py-2">{r.name}</td>
                                    <td>{r.email}</td>
                                </tr>
                            ))}
                            {!topPersonnel.length && <tr><td colSpan={2} className="py-4 text-indigo-900/50 text-center">Kayıt yok</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
