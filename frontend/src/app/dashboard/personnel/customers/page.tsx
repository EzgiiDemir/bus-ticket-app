'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';

type Customer={ passenger_name:string; passenger_email:string; passenger_phone?:string };

export default function Customers(){
    const [items,setItems]=useState<{data:Customer[]; next_page_url?:string; prev_page_url?:string} | null>(null);
    const load=(url?:string)=> axios.get(url||'/personnel/customers').then(r=>setItems(r.data));
    useEffect(()=>{ load(); },[]);
    return (
        <div className="space-y-4 text-indigo-900/70">
            <h1 className="text-2xl font-bold text-indigo-900">Müşteriler</h1>
            <div className="rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[700px] w-full text-sm">
                    <thead><tr className="text-left text-indigo-900/60"><th>Ad</th><th>E‑posta</th><th>Telefon</th></tr></thead>
                    <tbody>
                    {items?.data?.map((c,i)=> (
                        <tr key={i} className="border-t"><td className="py-2 font-medium">{c.passenger_name}</td><td>{c.passenger_email}</td><td>{c.passenger_phone||'-'}</td></tr>
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