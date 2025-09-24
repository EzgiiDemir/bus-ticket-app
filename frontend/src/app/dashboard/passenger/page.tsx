'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/app/lib/api';
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
    links?: any;
    meta?: { total?: number; current_page?: number; last_page?: number; next_page_url?: string|null; prev_page_url?: string|null } | any;
};

type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ------------ Yardımcılar ------------ */
const TRYc = new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2});
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');

const toPath = (u?:string|null)=>{
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try{ const url = new URL(u); return url.pathname + url.search; }
    catch{ return (API_BASE && u.startsWith(API_BASE)) ? u.slice(API_BASE.length) : u; }
};

function pickRows<T=any>(raw:any): { rows:T[]; total:number; next:string|null; prev:string|null }{
    if(!raw) return { rows:[], total:0, next:null, prev:null };
    if(Array.isArray(raw)) return { rows:raw, total:raw.length, next:null, prev:null };

    if(Array.isArray(raw.data)){
        const next = raw.next_page_url ?? raw?.links?.next ?? raw?.meta?.next_page_url ?? null;
        const prev = raw.prev_page_url ?? raw?.meta?.prev_page_url ?? null;
        const total = Number(raw.total ?? raw?.meta?.total ?? raw.data.length);
        return { rows: raw.data, total, next, prev };
    }

    if(Array.isArray(raw.orders)){
        const next = raw.next_page_url ?? null;
        const prev = raw.prev_page_url ?? null;
        const total = Number(raw.total ?? raw.orders.length);
        return { rows: raw.orders, total, next, prev };
    }

    return { rows:[], total:0, next:null, prev:null };
}

const clamp = (n:number,min:number,max:number)=> Math.max(min, Math.min(max, n));

/* ------------ Bileşen ------------ */
export default function PassengerOverview() {
    const { isLoading, token } = (myAppHook() as any) || {};

    const [latest, setLatest] = useState<Order[]>([]);
    const [summary, setSummary] = useState<{ orders: number; spent: number }>({ orders: 0, spent: 0 });

    const [err, setErr] = useState('');
    const [banner, setBanner] = useState('');

    const [page, setPage] = useState<PagePayload<Order> | null>(null);
    const [loadingPage, setLoadingPage] = useState(false);
    const [perPage, setPerPage] = useState(10);

    const currency = useMemo(
        () => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
        []
    );

    async function getJSON<T=any>(pathOrAbs:string):Promise<T>{
        const path = toPath(pathOrAbs) || pathOrAbs;
        const res = await api.get(path, token);
        return api.json<T>(res);
    }

    // Özet + son 5
    useEffect(() => {
        if (isLoading || !token) return;
        (async()=>{
            setErr(''); setBanner('');
            try{
                const p = clamp(perPage,5,100);
                const res = await api.get('/orders?per_page='+p, token);
                const data = await api.json<any>(res);
                const { rows, total } = pickRows<Order>(data);
                const safeRows = Array.isArray(rows) ? rows : [];
                setLatest(safeRows.slice(0,5));
                const spent = safeRows.reduce((s,x)=> s + Number(x.total||0), 0);
                setSummary({ orders: Number(total||safeRows.length), spent });
                setBanner(`Toplam ${Number(total||safeRows.length)} sipariş, son ${safeRows.slice(0,5).length} listelendi.`);
            } catch(e:any){
                const p:ApiErr|undefined = e?.response?.data;
                setErr(p?.message || e?.message || 'Veri alınamadı');
            }
        })();
    }, [isLoading, token, perPage]);

    // Sayfalı liste
    const load = async (url?: string) => {
        if (isLoading || !token) return;
        setLoadingPage(true); setErr(''); setBanner('');
        try{
            const data = url ? await getJSON<PagePayload<Order>>(url)
                : await getJSON<PagePayload<Order>>('/orders?per_page='+clamp(perPage,5,100));
            setPage(data);
            const { total } = pickRows<Order>(data);
            setBanner(`Sayfa yüklendi. Toplam ${Number(total||0)} kayıt.`);
        } catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || e?.message || 'Veri alınamadı');
        } finally{
            setLoadingPage(false);
        }
    };

    useEffect(() => { if (!isLoading && token) void load(); }, [isLoading, token, perPage]);

    // Tüm siparişleri CSV
    const exportAllCSV = async () => {
        if(!token) return;
        try{
            let url: string | null = `/orders?per_page=100`;
            const all: Order[] = [];
            for(let i=0;i<100;i++){
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
            const p:ApiErr|undefined = e?.response?.data;
            alert(p?.message || e?.message || 'Dışa aktarma hatası');
        }
    };

    if (isLoading) return <div className="p-6">Yükleniyor…</div>;
    if (!token) return <div className="p-6">Giriş yapın.</div>;

    const latestRows = latest;
    const { rows:pageRows, total, next, prev } = pickRows<Order>(page as any);

    return (
        <div className="space-y-6 text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Genel Bakış</h1>

            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Card title="Toplam Sipariş" value={summary.orders} />
                <Card title="Toplam Harcama" value={currency.format(summary.spent)} />
                <div className="rounded-2xl border bg-white p-4 flex items-end justify-between">
                    <div>
                        <div className="text-xs text-indigo-900/60">Dışa Aktarım</div>
                        <div className="text-sm text-indigo-900/80 mt-1">Tüm siparişlerin tamamı</div>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded-lg border disabled:opacity-50" onClick={exportAllCSV} disabled={isLoading}>CSV</button>
                        <button className="px-3 py-2 rounded-lg border" onClick={()=>exportJSON('ozet', summary)}>JSON</button>
                    </div>
                </div>
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
