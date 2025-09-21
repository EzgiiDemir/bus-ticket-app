'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { myAppHook } from '../../../../context/AppProvider';
import { fmtTR } from '@/app/lib/datetime';
import { exportCSV, exportJSON, fetchAllPages } from '@/app/lib/export';

type Order = {
    id: number;
    qty: number;
    unit_price: number;
    total: number;
    pnr: string;
    created_at: string;
    product?: {
        id: number;
        trip?: string;
        terminal_from?: string;
        terminal_to?: string;
        departure_time?: string;
        cost?: number;
    };
};

type PagePayload<T> = {
    data: T[];
    total?: number;
    next_page_url?: string | null;
    prev_page_url?: string | null;
    from?: number | null;
    to?: number | null;
};

export default function PassengerOverview() {
    const { isLoading, token } = myAppHook() as any;

    // Özet ve son siparişler (son 5)
    const [latest, setLatest] = useState<Order[]>([]);
    const [summary, setSummary] = useState<{ orders: number; spent: number }>({ orders: 0, spent: 0 });
    const [err, setErr] = useState('');

    // Sayfalı liste
    const [page, setPage] = useState<PagePayload<Order> | null>(null);
    const [loadingPage, setLoadingPage] = useState(false);
    const [perPage, setPerPage] = useState(10);

    // Para biçimlendirme
    const currency = useMemo(
        () => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
        []
    );

    // Full API URL (fetchAllPages için)
    const ABS = (p: string) => {
        const base = (axios.defaults.baseURL || '').replace(/\/+$/, '');
        return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
    };

    // İlk sayfa + hızlı özet
    useEffect(() => {
        if (isLoading || !token) return;
        setErr('');
        axios
            .get<PagePayload<Order>>('/orders', { params: { per_page: perPage } })
            .then(({ data }) => {
                const rows = data?.data ?? [];
                setLatest(rows.slice(0, 5));
                const spent = rows.reduce((s, x) => s + Number(x.total ?? 0), 0);
                setSummary({ orders: Number(data?.total ?? rows.length), spent });
            })
            .catch((e) => setErr(e?.response?.data?.message || 'Hata'));
    }, [isLoading, token, perPage]);

    // Sayfalı liste yükleyici
    const load = (url?: string) => {
        if (isLoading || !token) return;
        setLoadingPage(true);
        setErr('');
        const req = url
            ? axios.get<PagePayload<Order>>(url)
            : axios.get<PagePayload<Order>>('/orders', { params: { per_page: perPage } });
        req
            .then(({ data }) => setPage(data))
            .catch((e) => setErr(e?.response?.data?.message || 'Hata'))
            .finally(() => setLoadingPage(false));
    };

    useEffect(() => {
        if (isLoading || !token) return;
        load(); // ilk sayfa
    }, [isLoading, token, perPage]);

    // Tüm siparişleri CSV
    const exportAllCSV = async () => {
        try {
            const all = await fetchAllPages<Order>(ABS('/orders'), { per_page: 100 });
            const cols = [
                { key: 'pnr', title: 'PNR' },
                { key: 'Sefer', title: 'Sefer', map: (o: Order) => o.product?.trip ?? '' },
                { key: 'Güzergah', title: 'Güzergah', map: (o: Order) => `${o.product?.terminal_from ?? ''} → ${o.product?.terminal_to ?? ''}` },
                { key: 'Kalkış', title: 'Kalkış', map: (o: Order) => fmtTR(o.product?.departure_time) },
                { key: 'qty', title: 'Adet' },
                { key: 'unit_price', title: 'Birim' },
                { key: 'total', title: 'Toplam' },
                { key: 'Sipariş Tarihi', title: 'Sipariş Tarihi', map: (o: Order) => fmtTR(o.created_at) },
            ];
            exportCSV('siparislerim_tumu', all, cols as any);
        } catch (e: any) {
            alert(e?.message || 'Dışa aktarma hatası');
        }
    };

    // Görünen sayfanın CSV'si
    const exportPageCSV = () => {
        const rows = page?.data ?? [];
        exportCSV('siparislerim_bu_sayfa', rows, [
            { key: 'pnr', title: 'PNR' },
            { key: 'Sefer', title: 'Sefer', map: (o: Order) => o.product?.trip ?? '' },
            { key: 'Güzergah', title: 'Güzergah', map: (o: Order) => `${o.product?.terminal_from ?? ''} → ${o.product?.terminal_to ?? ''}` },
            { key: 'Kalkış', title: 'Kalkış', map: (o: Order) => fmtTR(o.product?.departure_time) },
            { key: 'qty', title: 'Adet' },
            { key: 'unit_price', title: 'Birim' },
            { key: 'total', title: 'Toplam' },
            { key: 'created_at', title: 'Sipariş Tarihi', map: (o: Order) => fmtTR(o.created_at) },
        ] as any);
    };

    // Özet JSON
    const exportSummaryJSON = () => exportJSON('ozet', summary);

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

            {/* Kartlar */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Card title="Toplam Sipariş" value={summary.orders} />
                <Card title="Toplam Harcama" value={currency.format(summary.spent)} />
                <div className="rounded-2xl border bg-white p-4 flex items-end justify-between">
                    <div>
                        <div className="text-xs text-indigo-900/60">Dışa Aktarım</div>
                        <div className="text-sm text-indigo-900/80 mt-1">Tüm siparişlerin tamamı</div>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded-lg border" onClick={exportAllCSV}>CSV</button>
                        <button className="px-3 py-2 rounded-lg border" onClick={exportSummaryJSON}>JSON</button>
                    </div>
                </div>
            </div>

            {/* Son 5 Sipariş */}
            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold">Son Siparişler (5)</h2>
                </div>

                {/* Mobil kartlar */}
                <div className="md:hidden space-y-3">
                    {latest.map(o=>(
                        <div key={o.id} className="rounded-xl border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-medium">{o.product?.trip ?? '-'}</div>
                                <div className="text-xs font-mono">{o.pnr}</div>
                            </div>
                            <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Güzergah</div>
                                <div>{o.product?.terminal_from} → {o.product?.terminal_to}</div>
                                <div className="text-indigo-900/60">Kalkış</div>
                                <div>{fmtTR(o.product?.departure_time)}</div>
                                <div className="text-indigo-900/60">Adet</div>
                                <div>{o.qty}</div>
                                <div className="text-indigo-900/60">Toplam</div>
                                <div className="font-semibold">{currency.format(Number(o.total||0))}</div>
                                <div className="text-indigo-900/60">Tarih</div>
                                <div>{fmtTR(o.created_at)}</div>
                            </div>
                        </div>
                    ))}
                    {!latest.length && <div className="text-center text-indigo-900/50">Kayıt yok</div>}
                </div>

                {/* Desktop tablo */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">PNR</th>
                            <th>Sefer</th>
                            <th>Güzergah</th>
                            <th>Kalkış</th>
                            <th>Adet</th>
                            <th>Toplam</th>
                            <th>Tarih</th>
                        </tr>
                        </thead>
                        <tbody>
                        {latest.map((o) => (
                            <tr key={o.id} className="border-t">
                                <td className="py-2 font-mono">{o.pnr}</td>
                                <td className="font-medium">{o.product?.trip ?? '-'}</td>
                                <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                                <td>{fmtTR(o.product?.departure_time)}</td>
                                <td>{o.qty}</td>
                                <td className="font-semibold">{currency.format(Number(o.total || 0))}</td>
                                <td>{fmtTR(o.created_at)}</td>
                            </tr>
                        ))}
                        {!latest.length && (
                            <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Card({ title, value }: { title: string; value: any }) {
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold text-indigo-900">{value}</div>
        </div>
    );
}
