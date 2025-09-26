// app/dashboard/.../orders/page.tsx  (ikinci verdiğin sayfa – “Siparişlerim” tablo + pasajer detay)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/app/lib/api';
import { BASE } from '@/app/lib/api';
import { myAppHook } from '../../../../../context/AppProvider';
import { fmtTR } from '@/app/lib/datetime';

/* ---- Types ---- */
type Passenger = {
    seat?: string;
    first_name?: string;
    last_name?: string;
    doc_type?: 'tc'|'passport'|string|null;
    national_id?: string|null;
    passport_no?: string|null;
    nationality?: string|null;
    email?: string|null;
    phone?: string|null;
};

type Order = {
    id:number;
    qty:number;
    unit_price:number;
    total:number;
    pnr:string;
    created_at:string;
    seats?: string[] | string | null;
    // Geriye dönük alanlar
    passenger_name?: string|null;
    passenger_doc?: string|null;
    passenger_national_id?: string|null;
    passenger_passport_no?: string|null;
    passenger_nationality?: string|null;
    passenger_email?: string|null;
    passenger_phone?: string|null;
    // Yeni JSON liste
    passengers?: Passenger[] | null;
    product?: {
        id:number;
        trip?:string;
        terminal_from?:string;
        terminal_to?:string;
        departure_time?:string;
        cost?:number;
    };
};

type PageLike<T> =
    | { data:T[]; total?:number; next_page_url?:string|null; prev_page_url?:string|null; meta?:any; links?:any }
    | { orders:T[]; total?:number; next_page_url?:string|null; prev_page_url?:string|null; meta?:any; links?:any }
    | T[];

type ApiErr = { message?:string; errors?:Record<string, string[]|string> };

/* ---- Helpers ---- */
const TRYc = new Intl.NumberFormat('tr-TR',{ style:'currency', currency:'TRY', maximumFractionDigits:2 });
const API_BASE = (process.env.NEXT_PUBLIC_API_URL||'').replace(/\/+$/,'');

const toPath = (u?:string|null) => {
    if(!u) return null;
    if(u.startsWith('/')) return u;
    try { const url = new URL(u); return url.pathname + url.search; }
    catch { return API_BASE && u.startsWith(API_BASE) ? u.slice(API_BASE.length) : u; }
};

function pickRows<T=any>(raw:any): { rows:T[]; total:number; next:string|null; prev:string|null }{
    if(!raw) return { rows:[], total:0, next:null, prev:null };
    if(Array.isArray(raw)) return { rows:raw, total:raw.length, next:null, prev:null };
    const rows: T[] = Array.isArray(raw.data) ? raw.data : (Array.isArray(raw.orders) ? raw.orders : []);
    const total = Number(raw.total ?? raw?.meta?.total ?? rows.length);
    const next  = raw.next_page_url ?? raw?.meta?.next_page_url ?? raw?.links?.next ?? null;
    const prev  = raw.prev_page_url ?? raw?.meta?.prev_page_url ?? raw?.links?.prev ?? null;
    return { rows, total, next, prev };
}
const clamp = (n:number,min:number,max:number)=> Math.max(min, Math.min(max, n));

const seatsJoin = (o:Order) => {
    const s = o.seats;
    if (Array.isArray(s)) return s.join(', ');
    if (typeof s === 'string' && s.trim()) {
        try { const j = JSON.parse(s); if (Array.isArray(j)) return j.join(', '); } catch {}
        return s;
    }
    if (Array.isArray(o.passengers)) return o.passengers.map(p=>p.seat).filter(Boolean).join(', ');
    return '';
};

const primaryPassenger = (o:Order) => {
    if (Array.isArray(o.passengers) && o.passengers.length) {
        const p = o.passengers[0];
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
        return name || o.passenger_name || '-';
    }
    return o.passenger_name || '-';
};

const allPassengersFlat = (o:Order): Passenger[] => {
    if (Array.isArray(o.passengers) && o.passengers.length) return o.passengers;
    return [{
        seat: Array.isArray(o.seats) ? o.seats[0] : (typeof o.seats==='string' ? o.seats : undefined),
        first_name: o.passenger_name?.split(' ')?.slice(0,-1)?.join(' ') || o.passenger_name || undefined,
        last_name: o.passenger_name?.split(' ')?.slice(-1)?.join(' ') || undefined,
        doc_type: o.passenger_doc || undefined,
        national_id: o.passenger_national_id || undefined,
        passport_no: o.passenger_passport_no || undefined,
        nationality: o.passenger_nationality || undefined,
        email: o.passenger_email || undefined,
        phone: o.passenger_phone || undefined,
    }];
};

/* ---------- CSV yardımcıları: Sunucu + İstemci fallback ---------- */
const csvEscape = (v:any)=>{ const s=String(v??''); return /[",;\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
const buildCsv = (h:string[], rows:(string|number)[][])=> '\uFEFF' + (h.length?h.map(csvEscape).join(';')+'\n':'') + rows.map(r=>r.map(csvEscape).join(';')).join('\n');
const downloadText=(fn:string,txt:string)=>{ const b=new Blob([txt],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=fn; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href); };
const saveCsv = async (filename:string, headers:string[], rows:(string|number)[][], token?:string)=>{
    try{
        const res = await fetch(`${BASE}/company/export/array`,{
            method:'POST',
            headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ filename, headings: headers, rows }),
        });
        if(!res.ok) throw new Error();
        const blob = await res.blob(); const a=document.createElement('a');
        a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    }catch{
        downloadText(filename, buildCsv(headers, rows));
    }
};

/* ---- Page ---- */
export default function Page(){
    const { token, isLoading } = (myAppHook() as any) || {};

    const [items,setItems] = useState<PageLike<Order>|null>(null);
    const [q,setQ] = useState('');
    const [perPage,setPerPage] = useState(10);
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState('');
    const [banner,setBanner] = useState('');

    // Listeyi yükle
    const load = async (url?:string) => {
        if(!token) return;
        setLoading(true); setErr(''); setBanner('');
        try{
            const path = url ? (toPath(url) as string) : '/orders';
            const params = url ? undefined : { per_page: clamp(perPage,5,100) };
            const res = await api.get(path, { token, params });
            const data = await api.json<PageLike<Order>>(res);
            setItems(data);
            const { total } = pickRows<Order>(data);
            setBanner(`Toplam ${total} kayıt yüklendi.`);
        } catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || e?.message || 'Veri alınamadı');
        } finally{
            setLoading(false);
        }
    };
    useEffect(()=>{ if(!isLoading && token) load(); },[isLoading, token, perPage]);

    const { rows, total, next, prev } = useMemo(()=> pickRows<Order>(items as any), [items]);

    // İstemci arama
    const filtered = useMemo(()=>{
        const s = q.trim().toLowerCase();
        if(!s) return rows;
        return rows.filter(o => JSON.stringify(o).toLowerCase().includes(s));
    },[rows,q]);

    // Kolon başlıkları
    const headers = ['PNR','Sefer','Güzergah','Kalkış','Koltuklar','İlk Yolcu','Adet','Birim','Toplam','Sipariş Tarihi'];

    // CSV: sayfada görünen (filtre sonrası) kayıtlar
    const exportPageCsv = async ()=>{
        await saveCsv('siparisler_sayfa.csv', headers, filtered.map(o=>[
            o.pnr,
            (o.product?.trip ?? '-'),
            `${o.product?.terminal_from ?? ''} → ${o.product?.terminal_to ?? ''}`,
            fmtTR(o.product?.departure_time),
            seatsJoin(o) || '',
            primaryPassenger(o),
            o.qty,
            Number(o.unit_price||0),
            Number(o.total||0),
            fmtTR(o.created_at),
        ]), token);
    };

    // CSV: tüm sayfalar (sunucudan dolaş)
    const exportAll = async () => {
        if(!token) return;
        setLoading(true); setErr(''); setBanner('');
        try{
            const out: Order[] = [];
            let url: string | null = `/orders?per_page=200`;
            for(let i=0;i<200;i++){
                const res = await api.get(url, { token });
                const data = await api.json<any>(res);
                const { rows, next } = pickRows<Order>(data);
                out.push(...rows);
                url = toPath(next||'');
                if(!url) break;
            }
            const rowsCsv = out.map(o=>[
                o.pnr,
                (o.product?.trip ?? '-'),
                `${o.product?.terminal_from ?? ''} → ${o.product?.terminal_to ?? ''}`,
                fmtTR(o.product?.departure_time),
                seatsJoin(o) || '',
                primaryPassenger(o),
                o.qty,
                Number(o.unit_price||0),
                Number(o.total||0),
                fmtTR(o.created_at),
            ]);
            await saveCsv('siparisler_hepsi.csv', headers, rowsCsv, token);
            setBanner(`Dışa aktarıldı: ${out.length} kayıt.`);
        }catch(e:any){
            const p:ApiErr|undefined = e?.response?.data;
            setErr(p?.message || e?.message || 'Dışa aktarma hatası');
        }finally{
            setLoading(false);
        }
    };

    // CSV: tek satır
    const exportOne = async (o:Order)=>{
        await saveCsv(`siparis_${o.id}.csv`, headers, [[
            o.pnr,
            (o.product?.trip ?? '-'),
            `${o.product?.terminal_from ?? ''} → ${o.product?.terminal_to ?? ''}`,
            fmtTR(o.product?.departure_time),
            seatsJoin(o) || '',
            primaryPassenger(o),
            o.qty,
            Number(o.unit_price||0),
            Number(o.total||0),
            fmtTR(o.created_at),
        ]], token);
    };

    if(isLoading) return <div className="p-6">Yükleniyor…</div>;
    if(!token)   return <div className="p-6">Giriş yapın.</div>;

    return (
        <div className="space-y-4 text-indigo-900">
            {/* Üst bar */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Siparişlerim</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        className="w-full sm:w-64 rounded-xl border px-3 py-2"
                        placeholder="Ara (PNR, sefer, koltuk, yolcu)"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                        aria-label="Arama"
                    />
                    <div className="flex gap-2">
                        <select
                            className="rounded-lg border px-2"
                            value={perPage}
                            onChange={e=>setPerPage(Number(e.target.value))}
                            aria-label="Sayfa başına"
                        >
                            {[5,10,20,50,100].map(n=><option key={n} value={n}>{n}/sayfa</option>)}
                        </select>
                        <button className="px-3 py-2 rounded-lg border" onClick={exportPageCsv}>Sayfa CSV</button>
                        <button className="px-3 py-2 rounded-lg border" onClick={exportAll}>Tümü CSV</button>
                        <button className="px-3 py-2 rounded-lg border disabled:opacity-50" onClick={()=>load()} disabled={loading}>Yenile</button>
                    </div>
                </div>
            </div>

            {/* Bannerlar */}
            {banner && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{banner}</div>}
            {err &&    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            {/* Tablo */}
            {/* --- Responsive Liste --- */}
            <div className="rounded-2xl border bg-white p-4">
                {/* Desktop (md+) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-[1000px] w-full text-sm">
                        <thead>
                        <tr className="text-left text-indigo-900/60">
                            <th className="py-2">PNR</th>
                            <th>Sefer</th>
                            <th>Güzergah</th>
                            <th>Kalkış</th>
                            <th>Koltuklar</th>
                            <th>İlk Yolcu</th>
                            <th>Adet</th>
                            <th>Birim</th>
                            <th>Toplam</th>
                            <th>Tarih</th>
                            <th>Detay</th>
                            <th className="text-right">CSV</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map(o=>(
                            <tr key={o.id} className="border-t align-top">
                                <td className="py-2 font-mono">{o.pnr}</td>
                                <td className="font-medium">{o.product?.trip ?? '-'}</td>
                                <td>{o.product?.terminal_from} → {o.product?.terminal_to}</td>
                                <td>{fmtTR(o.product?.departure_time)}</td>
                                <td>{seatsJoin(o) || '—'}</td>
                                <td>{primaryPassenger(o)}</td>
                                <td>{o.qty}</td>
                                <td>{TRYc.format(Number(o.unit_price||0))}</td>
                                <td className="font-semibold">{TRYc.format(Number(o.total||0))}</td>
                                <td>{fmtTR(o.created_at)}</td>
                                <td className="min-w-[220px]"><PassengerDetails order={o}/></td>
                                <td className="text-right">
                                    <button className="px-2 py-1 rounded-lg border" onClick={()=>exportOne(o)}>CSV</button>
                                </td>
                            </tr>
                        ))}
                        {!filtered.length && (
                            <tr><td colSpan={12} className="py-6 text-center text-indigo-900/50">{loading?'Yükleniyor…':'Kayıt yok'}</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile ( < md ) */}
                <div className="md:hidden space-y-3">
                    {filtered.map(o=>(
                        <div key={o.id} className="rounded-xl border p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-semibold truncate">{o.product?.trip ?? '-'}</div>
                                    <div className="text-xs text-indigo-900/60 break-words font-mono">{o.pnr}</div>
                                </div>
                                <button className="px-2 py-1 rounded-lg border shrink-0" onClick={()=>exportOne(o)}>CSV</button>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
                                <div className="text-indigo-900/60">Güzergah</div>
                                <div className="truncate">{o.product?.terminal_from} → {o.product?.terminal_to}</div>

                                <div className="text-indigo-900/60">Kalkış</div>
                                <div>{fmtTR(o.product?.departure_time)}</div>

                                <div className="text-indigo-900/60">Koltuklar</div>
                                <div className="truncate">{seatsJoin(o) || '—'}</div>

                                <div className="text-indigo-900/60">İlk Yolcu</div>
                                <div className="truncate">{primaryPassenger(o)}</div>

                                <div className="text-indigo-900/60">Adet</div>
                                <div>{o.qty}</div>

                                <div className="text-indigo-900/60">Birim</div>
                                <div>{TRYc.format(Number(o.unit_price||0))}</div>

                                <div className="text-indigo-900/60">Toplam</div>
                                <div className="font-semibold">{TRYc.format(Number(o.total||0))}</div>

                                <div className="text-indigo-900/60">Tarih</div>
                                <div>{fmtTR(o.created_at)}</div>
                            </div>

                            <div className="mt-2">
                                {/* Detaylar collapsible */}
                                <PassengerDetails order={o}/>
                            </div>
                        </div>
                    ))}
                    {!filtered.length && (
                        <div className="rounded-xl border p-6 text-center text-indigo-900/50">{loading?'Yükleniyor…':'Kayıt yok'}</div>
                    )}
                </div>

                {/* Pager */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mt-3">
                    <div className="text-sm text-indigo-900/60">Toplam {total} kayıt</div>
                    <div className="flex gap-2">
                        <button
                            disabled={!prev || loading}
                            onClick={()=> prev && load(prev)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            aria-label="Geri"
                        >Geri</button>
                        <button
                            disabled={!next || loading}
                            onClick={()=> next && load(next)}
                            className="px-3 py-1 rounded-lg border disabled:opacity-50"
                            aria-label="İleri"
                        >İleri</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---- Details ---- */
function PassengerDetails({ order }: { order: Order }){
    const pax = allPassengersFlat(order);

    return (
        <details className="rounded-lg border">
            <summary className="cursor-pointer px-3 py-1">Yolcu Detayları</summary>
            <div className="p-3 space-y-3">
                {pax.map((p,idx)=>(
                    <div key={idx} className="rounded-lg border p-2">
                        <div className="text-sm font-medium">
                            {idx+1}. { [p.first_name, p.last_name].filter(Boolean).join(' ') || order.passenger_name || '—' }
                            {p.seat ? ` • Koltuk ${p.seat}` : ''}
                        </div>
                        <div className="text-xs text-indigo-900/70 mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            <div>Belge: {p.doc_type?.toUpperCase?.() || order.passenger_doc || '—'}</div>
                            <div>
                                No: {p.doc_type==='tc' ? (p.national_id || order.passenger_national_id || '—')
                                : p.doc_type==='passport' ? (p.passport_no || order.passenger_passport_no || '—')
                                    : (order.passenger_national_id || order.passenger_passport_no || '—')}
                            </div>
                            <div>Uyruk: {p.nationality || order.passenger_nationality || '—'}</div>
                            <div>E-posta: {p.email || order.passenger_email || '—'}</div>
                            <div>Telefon: {p.phone || order.passenger_phone || '—'}</div>
                        </div>
                    </div>
                ))}
                {!pax.length && <div className="text-xs text-indigo-900/60">Yolcu bilgisi yok.</div>}
            </div>
        </details>
    );
}
