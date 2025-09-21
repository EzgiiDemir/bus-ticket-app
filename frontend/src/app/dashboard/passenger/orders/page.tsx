'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { fmtTR } from '@/app/lib/datetime';
import { exportCSV, exportJSON, fetchAllPages } from '@/app/lib/export';

type Order = {
    id:number; qty:number; unit_price:number; total:number; pnr:string; created_at:string;
    product:{id:number;trip?:string;terminal_from?:string;terminal_to?:string;departure_time?:string;cost?:number};
};

type Page<T> = { data:T[]; next_page_url?:string|null; prev_page_url?:string|null; total?:number };

export default function PassengerOrders(){
    const [items,setItems]=useState<Page<Order>|null>(null);
    const [q,setQ]=useState('');

    const load=(url?:string)=> axios.get(url||'/orders').then(r=>setItems(r.data));
    useEffect(()=>{ load(); },[]);

    const filtered = useMemo(()=>{
        const s = q.trim().toLowerCase();
        const rows = items?.data ?? [];
        if(!s) return rows;
        return rows.filter(o => JSON.stringify(o).toLowerCase().includes(s));
    },[items,q]);

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

    const exportAll = async () => {
        const all = await fetchAllPages<Order>('/api/orders');
        exportCSV('siparislerim_tumu.csv', all, cols as any);
    };

    const currency = useMemo(
        () => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }),
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
                        <button className="px-3 py-2 rounded-lg border" onClick={exportAll}>CSV</button>
                        <button className="px-3 py-2 rounded-lg border" onClick={()=>exportJSON('siparisler.json', filtered)}>JSON</button>
                    </div>
                </div>
            </div>

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
                        Toplam {items?.total ?? filtered.length} kayıt
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={!items?.prev_page_url}
                            onClick={()=>items?.prev_page_url && load(items.prev_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >Geri</button>
                        <button
                            disabled={!items?.next_page_url}
                            onClick={()=>items?.next_page_url && load(items.next_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >İleri</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
