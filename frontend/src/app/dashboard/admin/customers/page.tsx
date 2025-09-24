'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api } from '@/app/lib/api';
import { fmtTR } from '../../../../lib/datetime';
import { exportCSV } from '@/app/lib/export';
import { X, Eye } from 'lucide-react';

type Cust = {
    passenger_name: string;
    passenger_email: string;
    orders?: number | string;
    revenue?: number | string;
    last_order_at?: string | null;
};

type OrderRow = {
    id: number;
    pnr?: string;
    qty?: number;
    total?: number;
    created_at?: string;
    product?: { trip?: string; terminal_from?: string; terminal_to?: string; departure_time?: string; cost?: number };
};

export default function AdminCustomers(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<Cust[]>([]);
    const [q,setQ]=useState('');
    const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10);
    const [loading,setLoading]=useState(false);
    const [modalOpen,setModalOpen]=useState(false);
    const [modalCustomer,setModalCustomer]=useState<Cust|null>(null);

    // modal orders
    const [orders,setOrders]=useState<OrderRow[]>([]);
    const [ordersPage,setOrdersPage]=useState(1);
    const [ordersPer,setOrdersPer]=useState(10);
    const [ordersTotalPages,setOrdersTotalPages]=useState<number|null>(null);
    const [ordersLoading,setOrdersLoading]=useState(false);

    const toNum=(v:any)=>Number((typeof v==='string'?v.replace(',','.') : v) || 0);
    const fmtTL=(v:any)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(toNum(v));

    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
        setLoading(true);
        (async ()=>{
            try{
                const res = await api.get('/admin/customers', { token });
                const payload = await api.json<any>(res);
                const arr = payload?.customers ?? payload ?? [];
                setRows(Array.isArray(arr) ? arr : (arr.data||[]));
            }catch(e){ console.error(e); setRows([]); }
            finally{ setLoading(false); }
        })();
    },[isLoading,token,user]);

    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase();
        if(!t) return rows;
        return rows.filter(r =>
            [r.passenger_name, r.passenger_email, String(r.orders||''), String(r.revenue||'')]
                .some(x=> String(x||'').toLowerCase().includes(t))
        );
    },[rows,q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages, page]);

    const paged = useMemo(()=> {
        const start = (page-1)*pageSize;
        return filtered.slice(start, start+pageSize);
    },[filtered, page, pageSize]);

    // modal: load orders for customer
    const openCustomer = async (c: Cust) => {
        setModalCustomer(c);
        setModalOpen(true);
        setOrdersPage(1);
        await loadOrders(c,1,ordersPer);
    };

    const loadOrders = async (c: Cust|null, p:number, per:number) => {
        if(!c) return;
        setOrdersLoading(true);
        try{
            // identifier olarak customer_email url-encoded gönderiyoruz
            const identifier = encodeURIComponent(c.passenger_email || c.passenger_name);
            const res = await api.get(`/admin/customers/${identifier}/orders?per_page=${per}&page=${p}`, { token });
            const payload = await api.json<any>(res);
            // payload is a paginator
            const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
            setOrders(data);
            setOrdersTotalPages(payload?.last_page ?? null);
        }catch(e:any){
            console.error(e);
            setOrders([]);
            setOrdersTotalPages(null);
        }finally{
            setOrdersLoading(false);
        }
    };

    const exportCustomerOrders = async () => {
        if(!modalCustomer) return;
        // fetch all pages sequentially (reasonable for admin export)
        let all: OrderRow[] = [];
        let p = 1;
        const per = 100;
        while(true){
            try{
                const identifier = encodeURIComponent(modalCustomer.passenger_email || modalCustomer.passenger_name);
                const res = await api.get(`/admin/customers/${identifier}/orders?per_page=${per}&page=${p}`, { token });
                const payload = await api.json<any>(res);
                const data = Array.isArray(payload?.data) ? payload.data : [];
                all = all.concat(data as OrderRow[]);
                if(!payload?.next_page_url) break;
                p++;
                if(p>200) break; // safety
            }catch(e){ break; }
        }
        exportCSV(`orders_${modalCustomer.passenger_email || modalCustomer}`, all.map(o=>({
            id: o.id, pnr: o.pnr, qty: o.qty, total: o.total, product: o.product?.trip ?? `${o.product?.terminal_from} → ${o.product?.terminal_to}`, date: o.created_at
        })), [
            { key: 'id', title: 'ID' },
            { key: 'pnr', title: 'PNR' },
            { key: 'product', title: 'Sefer' },
            { key: 'qty', title: 'Adet' },
            { key: 'total', title: 'Tutar' },
            { key: 'date', title: 'Tarih' },
        ]);
    };

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-indigo-900/70">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Müşteriler</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        className="w-56 rounded-xl border px-3 py-2"
                        placeholder="Ara (ad, e-posta)…"
                        value={q}
                        onChange={e=>{ setQ(e.target.value); setPage(1); }}
                    />
                    <select
                        className="rounded-xl border px-3 py-2"
                        value={pageSize}
                        onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}
                        aria-label="Sayfa başına"
                    >
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>

                    <button
                        className="rounded-xl border px-3 py-2"
                        onClick={()=> {
                            exportCSV('musteriler_tumu', filtered.map(c=>({
                                name: c.passenger_name,
                                email: c.passenger_email,
                                orders: c.orders,
                                revenue: toNum(c.revenue),
                                last_order_at: c.last_order_at
                            })), [
                                { key:'id', title:'Müşteri ID' },
                                { key:'name', title:'Ad' },
                                { key:'email', title:'E-posta' },
                                { key:'orders', title:'Sipariş' },
                                { key:'revenue', title:'Gelir' },
                                { key:'last_order_at', title:'Son Sipariş' },
                            ]);
                        }}
                    >CSV</button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? ((page-1)*pageSize+1) : 0}–{Math.min(page*pageSize, total)}</b> / {total} •
                    &nbsp;Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th>Ad</th>
                            <th>E-posta</th>
                            <th>Sipariş</th>
                            <th>Gelir</th>
                            <th>Son Sipariş</th>
                            <th>İşlem</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paged.map((c,i)=>(
                            <tr key={`${c.passenger_email}-${i}`} className="border-t">
                                <td className="py-2">{c.passenger_name}</td>
                                <td>{c.passenger_email}</td>
                                <td>{c.orders ?? 0}</td>
                                <td>{fmtTL(c.revenue)}</td>
                                <td>{fmtTR(c.last_order_at)}</td>
                                <td>
                                    <button
                                        title="Detayları Gör"
                                        className="px-2 py-1 rounded-lg border inline-flex items-center gap-2"
                                        onClick={()=>openCustomer(c)}
                                    ><Eye size={16}/> Gör</button>
                                </td>
                            </tr>
                        ))}
                        {!paged.length && !loading && (
                            <tr><td colSpan={7} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> kişi</div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page<=1}
                            onClick={()=>setPage(p=>Math.max(1,p-1))}
                        >Önceki</button>
                        <span className="text-sm">{page} / {totalPages}</span>
                        <button
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            disabled={page>=totalPages}
                            onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                        >Sonraki</button>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && modalCustomer && (
                <CustomerOrdersModal
                    customer={modalCustomer}
                    orders={orders}
                    loading={ordersLoading}
                    page={ordersPage}
                    per={ordersPer}
                    totalPages={ordersTotalPages}
                    onClose={()=>{ setModalOpen(false); setModalCustomer(null); setOrders([]); }}
                    onPage={async (p, perPage) => { setOrdersPage(p); setOrdersPer(perPage); await loadOrders(modalCustomer, p, perPage); }}
                    onExport={exportCustomerOrders}
                />
            )}
        </div>
    );
}

/* ---------------- Modal component ---------------- */
function CustomerOrdersModal({ customer, orders, loading, page, per, totalPages, onClose, onPage, onExport }:{
    customer: Cust;
    orders: OrderRow[];
    loading:boolean;
    page:number;
    per:number;
    totalPages:number|null;
    onClose:()=>void;
    onPage:(p:number, per:number)=>void;
    onExport:()=>void;
}){
    return (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 grid place-items-center">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-white">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">{customer.passenger_name}</div>
                        <div className="text-xs text-indigo-900/60">{customer.passenger_email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 rounded-lg border" onClick={onExport}>Export</button>
                        <button className="px-3 py-1 rounded-lg border" onClick={onClose}><X size={16}/></button>
                    </div>
                </div>

                <div className="p-4">
                    <div className="mb-3 text-sm text-indigo-900/60">Toplam Sipariş: <b>{customer.orders}</b> • Gelir: <b>{new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(customer.revenue||0))}</b></div>

                    <div className="overflow-x-auto">
                        <table className="min-w-[720px] w-full text-sm">
                            <thead>
                            <tr className="text-left text-indigo-900/60">
                                <th className="py-2">ID</th>
                                <th>PNR</th>
                                <th>Sefer</th>
                                <th>Adet</th>
                                <th>Tutar</th>
                                <th>Tarih</th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="py-6 text-center">Yükleniyor…</td></tr>
                            ) : (orders.length ? orders.map(o=>(
                                <tr key={o.id} className="border-t">
                                    <td className="py-2">{o.id}</td>
                                    <td>{o.pnr}</td>
                                    <td>{o.product?.trip ?? `${o.product?.terminal_from} → ${o.product?.terminal_to}`}</td>
                                    <td>{o.qty}</td>
                                    <td>{new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(o.total||0))}</td>
                                    <td>{fmtTR(o.created_at)}</td>
                                </tr>
                            )) : (
                                <tr><td colSpan={6} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-indigo-900/60">Sayfa {page}{ totalPages ? ` / ${totalPages}` : ''}</div>
                        <div className="flex items-center gap-2">
                            <select className="rounded-lg border px-2 py-1" value={per} onChange={e=> onPage(1, Number(e.target.value))}>
                                {[5,10,25,50].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                            </select>
                            <button className="px-3 py-1 rounded-lg border" disabled={page<=1} onClick={()=> onPage(Math.max(1,page-1), per)}>Önceki</button>
                            <button className="px-3 py-1 rounded-lg border" disabled={totalPages!==null && page>= (totalPages||0)} onClick={()=> onPage(page+1, per)}>Sonraki</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
