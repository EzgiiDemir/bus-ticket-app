'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/app/lib/api';               // AUTH + CORS doğru
import { myAppHook } from '../../../../context/AppProvider';
import { fmtTR } from '@/app/lib/datetime';
import { exportCSV, exportJSON } from '@/app/lib/export';

/* ------------ Tipler ------------ */
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
    // Laravel alternatifleri:
    links?: { next?: string|null }[] | any;
    meta?: { total?: number; current_page?: number; last_page?: number; next_page_url?: string|null } | any;
};

/* ------------ Yardımcılar ------------ */
const TRYc = new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2});
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');

const toPath = (u?:string|null)=>{
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try{
        const url = new URL(u);
        return url.pathname + url.search;
    }catch{
        // API_BASE başına eklenmiş olabilir
        if(API_BASE && u.startsWith(API_BASE)) return u.slice(API_BASE.length);
        return u;
    }
};

function pickRows<T=any>(raw:any): { rows:T[]; total?:number; next?:string|null }{
    if(!raw) return { rows:[], total:0, next:null };
    // Dizi dönerse
    if(Array.isArray(raw)) return { rows:raw, total:raw.length, next:null };

    // Standart paginate
    if(Array.isArray(raw.data)){
        const next = raw.next_page_url ?? raw?.links?.next ?? raw?.meta?.next_page_url ?? null;
        const total = raw.total ?? raw?.meta?.total ?? raw.data.length;
        return { rows: raw.data, total, next };
    }

    // Nesne içinde orders alanı
    if(Array.isArray(raw.orders)){
        const next = raw.next_page_url ?? null;
        const total = raw.total ?? raw.orders.length;
        return { rows: raw.orders, total, next };
    }

    return { rows:[], total:0, next:null };
}

/* ------------ Bileşen ------------ */
export default function PassengerOverview() {
    const { isLoading, token } = (myAppHook() as any) || {};

    const [latest, setLatest] = useState<Order[]>([]);
    const [summary, setSummary] = useState<{ orders: number; spent: number }>({ orders: 0, spent: 0 });
    const [err, setErr] = useState('');

    const [page, setPage] = useState<PagePayload<Order> | null>(null);
    const [loadingPage, setLoadingPage] = useState(false);
    const [perPage, setPerPage] = useState(10);

    const currency = useMemo(
        () => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
        []
    );

    // Ortak GET (AUTH zorunlu)
    async function getJSON<T=any>(pathOrAbs:string, params?:Record<string,any>):Promise<T>{
        const path = toPath(pathOrAbs) || pathOrAbs;
        const res = await api.get(path, token);           // Bearer token ile
        // params için: path zaten query içeriyorsa parse edilmiştir, ilk çağrıda per_page ekliyoruz
        return api.json<T>(res);
    }

    // İlk özet + son 5
    useEffect(() => {
        if (isLoading || !token) return;
        (async()=>{
            setErr('');
            try{
                const res = await api.get('/orders?per_page='+perPage, token);
                const data = await api.json<any>(res);
                const { rows, total } = pickRows<Order>(data);
                setLatest(rows.slice(0,5));
                const spent = rows.reduce((s,x)=> s + Number(x.total||0), 0);
                setSummary({ orders: Number(total||rows.length), spent });
            } catch(e:any){
                setErr(e?.message || 'Veri alınamadı');
            }
        })();
    }, [isLoading, token, perPage]);

    // Sayfalı liste
    const load = async (url?: string) => {
        if (isLoading || !token) return;
        setLoadingPage(true); setErr('');
        try{
            const data = url ? await getJSON<PagePayload<Order>>(url) : await getJSON<PagePayload<Order>>('/orders?per_page='+perPage);
            setPage(data);
        } catch(e:any){
            setErr(e?.message || 'Veri alınamadı');
        } finally{
            setLoadingPage(false);
        }
    };

    useEffect(() => { if (!isLoading && token) load(); }, [isLoading, token, perPage]);

    // Tüm siparişleri CSV – AUTH ile sayfa sayfa çek
    const exportAllCSV = async () => {
        try{
            let url: string | null = `/orders?per_page=100`;
            const all: Order[] = [];
            for(let i=0;i<100;i++){ // sert üst limit
                const data = await getJSON<any>(url);
                const { rows, next } = pickRows<Order>(data);
                all.push(...rows);
                url = toPath(next||'');
                if(!url) break;
            }
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
        }catch(e:any){
            alert(e?.message || 'Dışa aktarma hatası');
        }
    };

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;

    const latestRows = latest;

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

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
                        <button className="px-3 py-2 rounded-lg border" onClick={()=>exportJSON('ozet', summary)}>JSON</button>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold">Son Siparişler (5)</h2>
                    <div className="flex items-center gap-2">
                        <select className="rounded-lg border px-2 py-1" value={perPage} onChange={e=>setPerPage(Number(e.target.value))}>
                            {[5,10,20,50].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                        </select>
                        <button className="px-3 py-2 rounded-lg border" onClick={()=>load()}>Yenile</button>
                    </div>
                </div>

                {/* Mobil */}
                <div className="md:hidden space-y-3">
                    {latestRows.map(o=>(
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
                                <div className="font-semibold">{TRYc.format(Number(o.total||0))}</div>
                                <div className="text-indigo-900/60">Tarih</div>
                                <div>{fmtTR(o.created_at)}</div>
                            </div>
                        </div>
                    ))}
                    {!latestRows.length && <div className="text-center text-indigo-900/50">Kayıt yok</div>}
                </div>

                {/* Desktop */}
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
                        {latestRows.map((o) => (
                            <tr key={o.id} className="border-t">
                                <td className="py-2 font-mono">{o.pnr}</td>
                                <td className="font-medium">{o.product?.trip ?? '-'}</td>
                                <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                                <td>{fmtTR(o.product?.departure_time)}</td>
                                <td>{o.qty}</td>
                                <td className="font-semibold">{TRYc.format(Number(o.total || 0))}</td>
                                <td>{fmtTR(o.created_at)}</td>
                            </tr>
                        ))}
                        {!latestRows.length && (
                            <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {loadingPage && <div className="mt-3 text-sm text-gray-500">Yükleniyor…</div>}
                {!!err && <div className="mt-3 text-sm text-red-600">{err}</div>}
            </div>
        </div>
    );
}

/* ------------ UI ------------ */
function Card({ title, value }: { title: string; value: any }) {
    return (
        <div className="rounded-2xl border bg-white p-4">
            <div className="text-xs text-indigo-900/60">{title}</div>
            <div className="text-2xl font-bold text-indigo-900">{value}</div>
        </div>
    );
}
