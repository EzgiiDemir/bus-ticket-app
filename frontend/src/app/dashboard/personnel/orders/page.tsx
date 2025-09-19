'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';

type Order = { id:number; qty:number; unit_price:number; total:number; pnr:string; created_at:string; product:{id:number;trip:string;terminal_from:string;terminal_to:string;departure_time:string;cost:number} };

export default function Orders(){
    const [items,setItems]=useState<{data:Order[]; next_page_url?:string; prev_page_url?:string} | null>(null);
    const load=(url?:string)=> axios.get(url||'/personnel/orders').then(r=>setItems(r.data));
    useEffect(()=>{ load(); },[]);
    return (
        <div className="space-y-4  text-indigo-900">
            <h1 className="text-2xl font-bold text-indigo-900">Siparişler</h1>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60"><th>PNR</th><th>Sefer</th><th>Yol</th><th>Kalkış</th><th>Adet</th><th>Birim</th><th>Toplam</th><th>Tarih</th></tr></thead>
                    <tbody>
                    {items?.data?.map(o=> (
                        <tr key={o.id} className="border-t">
                            <td className="py-2 font-mono">{o.pnr}</td>
                            <td className="font-medium">{o.product?.trip}</td>
                            <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                            <td>{o.product?.departure_time}</td>
                            <td>{o.qty}</td>
                            <td>{o.unit_price} ₺</td>
                            <td className="font-semibold">{o.total} ₺</td>
                            <td>{o.created_at}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <div className="flex justify-end gap-2 mt-3">
                    <button disabled={!items?.prev_page_url} onClick={()=>items?.prev_page_url && load(items.prev_page_url)} className="px-3 py-1 rounded-lg border disabled:opacity-50">Geri</button>
                    <button disabled={!items?.next_page_url} onClick={()=>items?.next_page_url && load(items.next_page_url)} className="px-3 py-1 rounded-lg border disabled:opacity-50">İleri</button>
                </div>
            </div>
        </div>
    );
}