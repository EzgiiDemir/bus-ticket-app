// app/dashboard/admin/customers/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { myAppHook } from '../../../../../context/AppProvider';
import { api } from '@/app/lib/api';
import { fmtTR } from '../../../../lib/datetime';
import { X, Eye } from 'lucide-react';
import { BASE } from '@/app/lib/api';

/* ---------- Tipler ---------- */
type Cust = { passenger_name: string; passenger_email: string; orders?: number | string; revenue?: number | string; last_order_at?: string | null; };
type OrderRow = { id: number; pnr?: string; qty?: number; total?: number; created_at?: string; product?: { trip?: string; terminal_from?: string; terminal_to?: string; departure_time?: string; cost?: number }; };

/* ---------- CSV helpers (sunucu→istemci fallback) ---------- */
const csvEscape=(v:any)=>{const s=String(v??'');return /[\";\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
const buildCsv=(h:string[], rows:(string|number)[][])=>'\uFEFF'+(h.length?h.map(csvEscape).join(';')+'\n':'')+rows.map(r=>r.map(csvEscape).join(';')).join('\n');
const downloadText=(fn:string,txt:string)=>{const b=new Blob([txt],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);};
const saveCsv=async(fn:string,h:string[],rows:(string|number)[][],token?:string)=>{
    try{
        const res=await fetch(`${BASE}/company/export/array`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({filename:fn,headings:h,rows})});
        if(!res.ok) throw new Error();
        const blob=await res.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    }catch{ downloadText(fn, buildCsv(h, rows)); }
};

export default function AdminCustomers(){
    const { token, isLoading, user } = myAppHook() as any;
    const [rows,setRows]=useState<Cust[]>([]);
    const [q,setQ]=useState(''); const [page,setPage]=useState(1);
    const [pageSize,setPageSize]=useState(10); const [loading,setLoading]=useState(false);

    const [modalOpen,setModalOpen]=useState(false); const [modalCustomer,setModalCustomer]=useState<Cust|null>(null);
    const [orders,setOrders]=useState<OrderRow[]>([]); const [ordersPage,setOrdersPage]=useState(1);
    const [ordersPer,setOrdersPer]=useState(10); const [ordersTotalPages,setOrdersTotalPages]=useState<number|null>(null);
    const [ordersLoading,setOrdersLoading]=useState(false);

    const toNum=(v:any)=>Number((typeof v==='string'?v.replace(',','.') : v) || 0);
    const fmtTL=(v:any)=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(toNum(v));

    /* Veri çek */
    useEffect(()=>{ if(isLoading||!token||user?.role!=='admin') return;
        setLoading(true);
        (async ()=>{
            try{
                const res = await api.get('/admin/customers', { token });
                const payload = await api.json<any>(res);
                const arr = payload?.customers ?? payload ?? [];
                setRows(Array.isArray(arr) ? arr : (arr.data||[]));
            }catch{ setRows([]); }
            finally{ setLoading(false); }
        })();
    },[isLoading,token,user]);

    /* Filtre + sayfalama */
    const filtered = useMemo(()=>{
        const t = q.trim().toLowerCase(); if(!t) return rows;
        return rows.filter(r =>
            [r.passenger_name, r.passenger_email, String(r.orders||''), String(r.revenue||'')]
                .some(x=> String(x||'').toLowerCase().includes(t))
        );
    },[rows,q]);

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    useEffect(()=>{ if(page>totalPages) setPage(totalPages); },[totalPages, page]);
    const paged = useMemo(()=> filtered.slice((page-1)*pageSize, (page-1)*pageSize+pageSize), [filtered, page, pageSize]);

    /* CSV */
    const headers=['ID','Ad','E-posta','Sipariş','Gelir','Son Sipariş'];
    const rowToCsv=(c:Cust, idx:number):(number | string)[]=>[
        idx, c.passenger_name, c.passenger_email, (c.orders??0), (c.revenue??0), (c.last_order_at||'')
    ];
    const exportPageCsv = ()=> saveCsv('musteriler_sayfa.csv', headers,
        paged.map((c,i)=>rowToCsv(c,(page-1)*pageSize + i + 1)) as any, token);
    const exportAllCsv  = ()=> saveCsv('musteriler_tumu.csv', headers,
        filtered.map((c,i)=>rowToCsv(c,i+1)) as any, token);
    const exportOneCsv  = (c:Cust, idx:number)=> saveCsv(`musteri_${idx}.csv`, headers, [rowToCsv(c, idx)] as any, token);

    /* Modal veri */
    const openCustomer = async (c: Cust) => {
        setModalCustomer(c); setModalOpen(true); setOrdersPage(1);
        await loadOrders(c,1,ordersPer);
    };
    const loadOrders = async (c: Cust|null, p:number, per:number) => {
        if(!c) return;
        setOrdersLoading(true);
        try{
            const identifier = encodeURIComponent(c.passenger_email || c.passenger_name);
            const res = await api.get(`/admin/customers/${identifier}/orders?per_page=${per}&page=${p}`, { token });
            const payload = await api.json<any>(res);
            const data = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
            setOrders(data); setOrdersTotalPages(payload?.last_page ?? null);
        }catch{
            setOrders([]); setOrdersTotalPages(null);
        }finally{ setOrdersLoading(false); }
    };
    const exportCustomerOrders = async () => {
        if(!modalCustomer) return;
        let all: OrderRow[] = []; let p = 1; const per = 100;
        while(true){
            try{
                const identifier = encodeURIComponent(modalCustomer.passenger_email || modalCustomer.passenger_name);
                const res = await api.get(`/admin/customers/${identifier}/orders?per_page=${per}&page=${p}`, { token });
                const payload = await api.json<any>(res);
                const data:OrderRow[] = Array.isArray(payload?.data) ? payload.data : [];
                all = all.concat(data);
                if(!payload?.next_page_url) break;
                p++; if(p>200) break;
            }catch{ break; }
        }
        await saveCsv(`musteri_siparisleri_${(modalCustomer.passenger_email||modalCustomer.passenger_name).replace(/\s+/g,'_')}.csv`,
            ['ID','PNR','Sefer','Adet','Tutar','Tarih'],
            all.map(o=>[
                o.id, (o.pnr||''), (o.product?.trip ?? `${o.product?.terminal_from||''} → ${o.product?.terminal_to||''}`),
                (o.qty??0), (o.total??0), (o.created_at||'')
            ]) as any, token
        );
    };

    if (isLoading) return <div>Yükleniyor…</div>;
    if (!token) return <div>Giriş yapın.</div>;
    if (user?.role!=='admin') return <div>Yetkisiz.</div>;

    return (
        <div className="space-y-4 text-indigo-900/70">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="text-2xl font-bold text-indigo-900">Müşteriler</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <input className="w-56 rounded-xl border px-3 py-2" placeholder="Ara (ad, e-posta)…" value={q} onChange={e=>{ setQ(e.target.value); setPage(1); }}/>
                    <select className="rounded-xl border px-3 py-2" value={pageSize} onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1); }}>
                        {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/sayfa</option>)}
                    </select>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportPageCsv}>Sayfa CSV</button>
                    <button className="px-3 py-1 rounded-lg border" onClick={exportAllCsv}>Tümü CSV</button>
                </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm text-indigo-900/60">
                    Görüntülenen: <b>{total ? ((page-1)*pageSize+1) : 0}–{Math.min(page*pageSize, total)}</b> / {total} • Sayfa {page}/{totalPages}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th>ID</th><th>Ad</th><th>E-posta</th><th>Sipariş</th><th>Gelir</th><th>Son Sipariş</th><th>İşlem</th><th className="text-right">CSV</th>
                        </tr>
                        </thead>
                        <tbody>
                        {paged.map((c,i)=>(
                            <tr key={`${c.passenger_email}-${i}`} className="border-t">
                                <td className="py-2">{(page-1)*pageSize + i + 1}</td>
                                <td className="py-2">{c.passenger_name}</td>
                                <td>{c.passenger_email}</td>
                                <td>{c.orders ?? 0}</td>
                                <td>{fmtTL(c.revenue)}</td>
                                <td>{fmtTR(c.last_order_at)}</td>
                                <td className="space-x-2">
                                    <button className="px-2 py-1 rounded-lg border inline-flex items-center gap-2" onClick={()=>openCustomer(c)}><Eye size={16}/> Gör</button>
                                </td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border" onClick={()=>exportOneCsv(c,(page-1)*pageSize+i+1)}>CSV</button>
                                </td>
                            </tr>
                        ))}
                        {!paged.length && !loading && <tr><td colSpan={8} className="py-6 text-center text-indigo-900/50">Kayıt yok</td></tr>}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
                    <div className="text-xs text-indigo-900/60">Toplam <b>{total}</b> kişi</div>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Önceki</button>
                        <span className="text-sm">{page} / {totalPages}</span>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Sonraki</button>
                    </div>
                </div>
            </div>

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

function CustomerOrdersModal({ customer, orders, loading, page, per, totalPages, onClose, onPage, onExport }:{
    customer: Cust; orders: OrderRow[]; loading:boolean; page:number; per:number; totalPages:number|null;
    onClose:()=>void; onPage:(p:number, per:number)=>void; onExport:()=>void;
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
                    <div className="mb-3 text-sm text-indigo-900/60">
                        Toplam Sipariş: <b>{customer.orders}</b> • Gelir: <b>{new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(customer.revenue||0))}</b>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-[720px] w-full text-sm">
                            <thead>
                            <tr className="text-left text-indigo-900/60">
                                <th className="py-2">ID</th><th>PNR</th><th>Sefer</th><th>Adet</th><th>Tutar</th><th>Tarih</th>
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
