'use client';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { exportCSV, fetchAllPages } from '@/app/lib/export';

type Customer = { passenger_name:string; passenger_email:string; passenger_phone?:string|null };
type Page<T> = {
    data:T[]; current_page:number; last_page:number; total:number;
    from?:number|null; to?:number|null;
    next_page_url?:string|null; prev_page_url?:string|null;
};

export default function Customers(){
    const [page,setPage]=useState<Page<Customer>|null>(null);
    const [q,setQ]=useState('');
    const [perPage,setPerPage]=useState(10);
    const [loading,setLoading]=useState(false);

    const load = async (url?:string) => {
        setLoading(true);
        try{
            const { data } = await axios.get<Page<Customer>>(url || '/personnel/customers', { params:{ q, per_page: perPage } });
            setPage(data);
        } finally { setLoading(false); }
    };

    useEffect(()=>{ load(); },[]);
    useEffect(()=>{
        const t = setTimeout(()=> load('/personnel/customers'), 300);
        return ()=>clearTimeout(t);
    },[q,perPage]);

    const rows = page?.data ?? [];
    const count = useMemo(()=> rows.length, [rows]);

    return (
        <div className="space-y-4 text-indigo-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Müşteriler</h1>
                <div className="flex items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (ad, e-posta, tel)…"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={perPage}
                        onChange={e=>setPerPage(Number(e.target.value))}
                        aria-label="Sayfa başına"
                    >
                        {[10,20,50].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button
                        className="rounded-xl border px-3 py-2"
                        onClick={async ()=>{
                            const all = await fetchAllPages<Customer>('/personnel/customers', { q, per_page: 100 });
                            exportCSV('musteriler_tumu', all, [
                                { key:'passenger_name', title:'Ad' },
                                { key:'passenger_email', title:'E-posta' },
                                { key:'passenger_phone', title:'Telefon' },
                            ]);
                        }}
                    >CSV</button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{page?.from ?? 0}–{page?.to ?? 0}</b> / {page?.total ?? 0} •
                    &nbsp;Bu sayfada {count} kişi
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">Ad</th><th>E-posta</th><th>Telefon</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((c,i)=>(
                            <tr key={i} className="border-t">
                                <td className="py-2 font-medium">{c.passenger_name}</td>
                                <td>{c.passenger_email}</td>
                                <td>{c.passenger_phone || '-'}</td>
                            </tr>
                        ))}
                        {!rows.length && !loading && (
                            <tr><td colSpan={3} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4">
                    <div className="text-xs text-indigo-900/60">
                        Sayfa {page?.current_page ?? 0} / {page?.last_page ?? 0}
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={!page?.prev_page_url || loading}
                            onClick={()=> page?.prev_page_url && load(page.prev_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >Geri</button>
                        <button
                            disabled={!page?.next_page_url || loading}
                            onClick={()=> page?.next_page_url && load(page.next_page_url)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                        >İleri</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
