'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { fmtTR } from '@/app/lib/datetime';
import { exportCSV, exportJSON } from '@/app/lib/export';
import { myAppHook } from '../../../../../context/AppProvider';

type Order = {
    id:number; qty:number; unit_price:number; total:number; pnr:string; created_at:string;
    product:{ id:number; trip?:string; terminal_from?:string; terminal_to?:string; departure_time?:string; cost?:number };
};

type Page<T> = {
    data:T[];
    current_page?:number; last_page?:number; per_page?:number; total?:number;
    next_page_url?:string|null; prev_page_url?:string|null;
};

const PER_PAGE = 10;

export default function PassengerOrders(){
    const router = useRouter();
    const { token, isLoading } = myAppHook() as any;

    const [items,setItems]=useState<Page<Order>|null>(null);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [loading,setLoading]=useState(false);
    const [err,setErr]=useState('');

    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    const loadByUrl = async (url:string)=>{
        setLoading(true);
        try{
            const { data } = await axios.get<Page<Order>>(url, { headers: authHeader });
            setItems(data);
            setPage(data.current_page ?? page);
            setErr('');
        }catch(e:any){
            handleErr(e);
        }finally{ setLoading(false); }
    };

    const loadPage = async (p:number)=>{
        setLoading(true);
        try{
            const { data } = await axios.get<Page<Order>>('/orders', {
                headers: authHeader,
                params: { page: p, per_page: PER_PAGE },
            });
            setItems(data);
            setPage(data.current_page ?? p);
            setErr('');
        }catch(e:any){
            handleErr(e);
        }finally{ setLoading(false); }
    };

    const handleErr=(e:any)=>{
        if (e?.response?.status === 401){
            setErr('Oturum doğrulanamadı. Giriş yapın.');
            router.push('/auth?mode=login');
        }else{
            setErr(e?.response?.data?.message || 'Listeleme hatası');
        }
    };

    useEffect(()=>{
        if (isLoading) return;
        if (!token){ router.push('/auth?mode=login'); return; }
        loadPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[token, isLoading]);

    const rows = items?.data ?? [];
    const filtered = useMemo(()=>{
        const s=q.trim().toLowerCase();
        if(!s) return rows;
        return rows.filter(o=> JSON.stringify(o).toLowerCase().includes(s));
    },[rows,q]);

    const lastPage =
        items?.last_page
        ?? (items?.total && (items as any).per_page
            ? Math.max(1, Math.ceil((items.total as number)/((items as any).per_page as number)))
            : undefined);

    const goFirst = ()=> lastPage ? loadPage(1) : items?.prev_page_url ? loadByUrl(items.prev_page_url.replace(/page=\d+/, 'page=1')) : loadPage(1);
    const goPrev  = ()=> items?.prev_page_url ? loadByUrl(items.prev_page_url) : loadPage(Math.max(1, page-1));
    const goNext  = ()=> items?.next_page_url ? loadByUrl(items.next_page_url) : loadPage(lastPage ? Math.min(lastPage, page+1) : page+1);
    const goLast  = ()=> lastPage ? loadPage(lastPage) : undefined;

    const cols = [
        { key:'pnr', title:'PNR' },
        { key:'trip', title:'Sefer', map:(o:Order)=>o.product?.trip ?? '' },
        { key:'route', title:'Güzergah', map:(o:Order)=>`${o.product?.terminal_from ?? ''} → ${o.product?.terminal_to ?? ''}` },
        { key:'departure', title:'Kalkış', map:(o:Order)=>fmtTR(o.product?.departure_time) },
        { key:'qty', title:'Adet' },
        { key:'unit_price', title:'Birim' },
        { key:'total', title:'Toplam' },
        { key:'created_at', title:'Sipariş Tarihi', map:(o:Order)=>fmtTR(o.created_at) },
    ];

    const exportAll = async ()=>{
        if (!token){ router.push('/auth?mode=login'); return; }
        try{
            const all:Order[] = [];
            // ilk sayfadan başlayıp sırayla getir
            let url = `/orders?page=1&per_page=${PER_PAGE}`;
            // döngü: next_page_url varsa onu kullan
            for(;;){
                const { data } = await axios.get<Page<Order>>(url, { headers: authHeader });
                all.push(...(data?.data ?? []));
                if (data?.next_page_url){ url = data.next_page_url; }
                else break;
            }
            exportCSV('siparislerim_tumu.csv', all, cols as any);
        }catch(e:any){
            alert(e?.response?.data?.message || 'Dışa aktarma hatası');
        }
    };

    const currency = useMemo(
        () => new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 }),
        []
    );

    return (
        <div className="space-y-4 text-indigo-900">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Siparişlerim</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        className="w-full sm:w-64 rounded-xl border px-3 py-2"
                        placeholder="Ara (PNR, sefer...)"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button className="px-3 py-2 rounded-lg border" onClick={exportAll} disabled={loading}>CSV (tümü)</button>
                        <button className="px-3 py-2 rounded-lg border" onClick={()=>exportJSON('siparisler.json', filtered)} disabled={loading}>JSON (bu sayfa)</button>
                    </div>
                </div>
            </div>

            {err && <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 p-3 text-sm">{err}</div>}
            {loading && <div className="text-sm text-indigo-900/60">Yükleniyor…</div>}

            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">PNR</th><th>Sefer</th><th>Güzergah</th><th>Kalkış</th><th>Adet</th><th>Birim</th><th>Toplam</th><th>Tarih</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map(o=>(
                        <tr key={o.id} className="border-t">
                            <td className="py-2 font-mono">{o.pnr}</td>
                            <td className="font-medium">{o.product?.trip ?? '-'}</td>
                            <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                            <td>{fmtTR(o.product?.departure_time)}</td>
                            <td>{o.qty}</td>
                            <td>{currency.format(Number(o.unit_price||0))}</td>
                            <td className="font-semibold">{currency.format(Number(o.total||0))}</td>
                            <td>{fmtTR(o.created_at)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mt-3">
                    <div className="text-sm text-indigo-900/60">
                        Toplam {items?.total ?? rows.length} kayıt • Sayfa {page}{lastPage?`/${lastPage}`:''}
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || page<=1} onClick={goFirst}>İlk</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || !items?.prev_page_url && page<=1} onClick={goPrev}>Geri</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || (!items?.next_page_url && lastPage!==undefined && page>=lastPage)} onClick={goNext}>İleri</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || lastPage===undefined || page>=lastPage} onClick={goLast}>Son</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
