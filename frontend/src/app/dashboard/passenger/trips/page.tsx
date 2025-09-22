'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { myAppHook } from '../../../../../context/AppProvider';
import { exportCSV, exportJSON } from '@/app/lib/export';

type Trip = {
    id:number; trip?:string; company_name?:string;
    terminal_from:string; terminal_to:string;
    departure_time:string; cost:number; is_active:number|boolean;
    duration?:string; bus_type?:'2+1'|'2+2'|string;
    route?: { name:string; time?:string }[];
};
type TripDetail = Trip & {
    taken_seats?: string[];
    seat_map?: { layout?: '2+1'|'2+2'; rows?: number };
    important_notes?: string|null;
    cancellation_policy?: string|null;
};
type PurchaseResp = { status:boolean; message?:string; order?:any; pnr?:string };

type Page<T> = {
    data:T[]; current_page?:number; last_page?:number; per_page?:number; total?:number;
    next_page_url?:string|null; prev_page_url?:string|null;
};

const PER_PAGE = 10;
const fmtTR = (iso?:string) =>
    iso ? new Date(iso).toLocaleString('tr-TR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';

export default function PassengerTrips(){
    const router = useRouter();
    const { isLoading, token } = myAppHook() as any;

    const [pageData,setPageData] = useState<Page<Trip>|null>(null);
    const [page,setPage] = useState(1);
    const [q,setQ] = useState('');
    const [loading,setLoading] = useState(false);
    const [err,setErr] = useState('');

    const [open,setOpen]=useState(false);
    const [detail,setDetail]=useState<TripDetail|null>(null);
    const [submitting,setSubmitting]=useState(false);

    const currency = useMemo(
        ()=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}),[]
    );

    // --- public/products her iki şekle de uyumlu yükleyici ---
    const normalizeToPage = (res:any, p:number): Page<Trip> => {
        // 1) {status:true, products:[...]} (senin publicIndex)
        if (res?.status === true && Array.isArray(res?.products)) {
            const all:Trip[] = res.products;
            const start = (p-1)*PER_PAGE;
            const slice = all.slice(start, start+PER_PAGE);
            return {
                data: slice,
                total: all.length,
                per_page: PER_PAGE,
                current_page: p,
                last_page: Math.max(1, Math.ceil(all.length/PER_PAGE)),
                next_page_url: null,
                prev_page_url: null,
            };
        }
        // 2) {data:[...], total, per_page, current_page, ...} (Laravel paginator)
        if (Array.isArray(res?.data) && (typeof res?.total === 'number' || typeof res?.per_page === 'number')) {
            return res as Page<Trip>;
        }
        // 3) Düz dizi
        if (Array.isArray(res)) {
            const all:Trip[] = res;
            const start = (p-1)*PER_PAGE;
            const slice = all.slice(start, start+PER_PAGE);
            return {
                data: slice,
                total: all.length,
                per_page: PER_PAGE,
                current_page: p,
                last_page: Math.max(1, Math.ceil(all.length/PER_PAGE)),
                next_page_url: null,
                prev_page_url: null,
            };
        }
        // 4) Güvenli varsayılan
        return { data: [], total: 0, per_page: PER_PAGE, current_page: 1, last_page: 1, next_page_url: null, prev_page_url: null };
    };

    const loadByUrl = async (url:string)=>{
        setLoading(true);
        try{
            const { data } = await axios.get(url);
            setPageData(normalizeToPage(data, page));
            setPage((data?.current_page ?? page) || 1);
            setErr('');
        }catch(e:any){
            setErr(e?.response?.data?.message || 'Seferler alınamadı');
        }finally{ setLoading(false); }
    };

    const loadPage = async (p:number)=>{
        setLoading(true);
        try{
            const { data } = await axios.get('/public/products', { params: { page: p, per_page: PER_PAGE } });
            setPageData(normalizeToPage(data, p));
            setPage(p);
            setErr('');
        }catch(e:any){
            setErr(e?.response?.data?.message || 'Seferler alınamadı');
        }finally{ setLoading(false); }
    };

    useEffect(()=>{ loadPage(1); },[]);

    const rows = pageData?.data ?? [];
    const filtered = useMemo(()=>{
        const s=q.trim().toLowerCase();
        if(!s) return rows;
        return rows.filter(r=> JSON.stringify(r).toLowerCase().includes(s));
    },[rows,q]);

    const lastPage =
        pageData?.last_page
        ?? (pageData?.total && pageData?.per_page
            ? Math.max(1, Math.ceil((pageData.total as number)/(pageData.per_page as number)))
            : 1);

    const goFirst = ()=> loadPage(1);
    const goPrev  = ()=> pageData?.prev_page_url ? loadByUrl(pageData.prev_page_url) : loadPage(Math.max(1, page-1));
    const goNext  = ()=> pageData?.next_page_url ? loadByUrl(pageData.next_page_url) : loadPage(Math.min(lastPage, page+1));
    const goLast  = ()=> loadPage(lastPage);

    // --- Detail (public detail yoksa /products/:id'e düş) ---
    const openDetail = async (id:number)=>{
        setLoading(true);
        try{
            let data: any;
            try {
                ({ data } = await axios.get(`/public/products/${id}`));
            } catch {
                ({ data } = await axios.get(`/products/${id}`)); // fallback
            }
            const rowsCount = data?.seat_map?.rows ?? 12;
            const layout = data?.seat_map?.layout || data?.bus_type || '2+1';
            setDetail({ ...data, seat_map:{ rows: rowsCount, layout }, taken_seats: data.taken_seats || [] });
            setOpen(true);
        } catch(e:any){
            alert(e?.response?.data?.message || 'Sefer bulunamadı');
        } finally { setLoading(false); }
    };

    // --- Purchase (auth required) ---
    const purchase = async (payload:any)=>{
        if (isLoading) return;
        if (!token) { router.push('/auth?mode=login'); return; }
        setSubmitting(true);
        try{
            const { data } = await axios.post<PurchaseResp>('/orders', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data?.status) {
                alert(`PNR: ${data.pnr || ''}`);
                setOpen(false); setDetail(null);
                router.push('/dashboard/passenger');
            } else {
                alert(data?.message || 'Satın alma başarısız');
            }
        } catch(e:any){
            const m = e?.response?.data?.message
                || (e?.response?.data?.errors && Object.values(e.response.data.errors).flat().join('\n'))
                || 'Satın alma hatası';
            alert(m);
        } finally { setSubmitting(false); }
    };

    return (
        <div className="space-y-4 text-indigo-900">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-indigo-900">Sefer Ara</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        className="w-full sm:w-64 rounded-xl border px-3 py-2"
                        placeholder="Ara (şehir, firma...)"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button
                            className="px-3 py-2 rounded-lg border"
                            onClick={()=>exportCSV('seferler', rows, [
                                { key:'trip', title:'Sefer' },
                                { key:'company_name', title:'Firma' },
                                { key:'route', title:'Güzergâh', map:(r:Trip)=>`${r.terminal_from} → ${r.terminal_to}` },
                                { key:'departure_time', title:'Kalkış', map:(r:Trip)=>fmtTR(r.departure_time) },
                                { key:'cost', title:'Ücret', map:(r:Trip)=>currency.format(Number(r.cost||0)) },
                                { key:'duration', title:'Süre' },
                                { key:'bus_type', title:'Otobüs Tipi' },
                            ] as any)}
                        >CSV</button>
                        <button className="px-3 py-2 rounded-lg border" onClick={()=>exportJSON('seferler', rows)}>JSON</button>
                    </div>
                </div>
            </div>

            {err && <div className="rounded-xl border border-red-300 bg-red-50 text-red-700 p-3 text-sm">{err}</div>}
            {loading && <div className="text-sm text-indigo-900/60">Yükleniyor…</div>}

            {/* Mobil */}
            <div className="md:hidden space-y-3">
                {filtered.map(r=>(
                    <div key={r.id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold">{r.trip ?? '-'}</div>
                            <span className="text-xs px-2 py-1 rounded-lg border">{r.company_name ?? '-'}</span>
                        </div>
                        <div className="mt-2 text-sm grid grid-cols-2 gap-y-1">
                            <div className="text-indigo-900/60">Güzergâh</div><div>{r.terminal_from} → {r.terminal_to}</div>
                            <div className="text-indigo-900/60">Kalkış</div><div>{fmtTR(r.departure_time)}</div>
                            <div className="text-indigo-900/60">Ücret</div><div>{currency.format(Number(r.cost||0))}</div>
                            <div className="text-indigo-900/60">Süre</div><div>{r.duration ?? '-'}</div>
                            <div className="text-indigo-900/60">Otobüs</div><div>{r.bus_type ?? '-'}</div>
                        </div>
                        <div className="mt-3 flex justify-end">
                            <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white" onClick={()=>openDetail(r.id)}>Satın Al</button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block rounded-2xl border bg-white p-4 overflow-x-auto">
                <table className="min-w-[980px] w-full text-sm">
                    <thead>
                    <tr className="text-left text-indigo-900/60">
                        <th className="py-2">Sefer</th><th>Firma</th><th>Güzergah</th><th>Kalkış</th><th>Ücret</th><th>Süre</th><th>Otobüs</th><th className="text-right">İşlem</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map(r=>(
                        <tr key={r.id} className="border-t">
                            <td className="py-2 font-medium">{r.trip ?? '-'}</td>
                            <td>{r.company_name ?? '-'}</td>
                            <td>{r.terminal_from} → {r.terminal_to}</td>
                            <td>{fmtTR(r.departure_time)}</td>
                            <td>{currency.format(Number(r.cost||0))}</td>
                            <td>{r.duration ?? '-'}</td>
                            <td>{r.bus_type ?? '-'}</td>
                            <td className="text-right">
                                <button className="px-3 py-2 rounded-lg border" onClick={()=>openDetail(r.id)}>Satın Al</button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mt-3">
                    <div className="text-sm text-indigo-900/60">
                        Toplam {pageData?.total ?? rows.length} kayıt • Sayfa {page}/{lastPage}
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || page<=1} onClick={goFirst}>İlk</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || page<=1} onClick={goPrev}>Geri</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || page>=lastPage} onClick={goNext}>İleri</button>
                        <button className="px-3 py-1 rounded-lg border disabled:opacity-50" disabled={loading || page>=lastPage} onClick={goLast}>Son</button>
                    </div>
                </div>
            </div>

            {open && detail && (
                <PurchaseModal
                    detail={detail}
                    onClose={()=>{ setOpen(false); setDetail(null); }}
                    onPurchased={(pnr)=>{ alert(`PNR: ${pnr}`); setOpen(false); setDetail(null); router.push('/dashboard/passenger'); }}
                    submitting={submitting}
                    onPurchase={purchase}
                />
            )}
        </div>
    );
}

/* ---------------- Modal + SeatMap ---------------- */

function PurchaseModal({
                           detail, onClose, onPurchased, submitting, onPurchase
                       }:{ detail:TripDetail; onClose:()=>void; onPurchased:(pnr:string)=>void; submitting:boolean; onPurchase:(payload:any)=>Promise<void> }){
    const layout = (detail.seat_map?.layout || detail.bus_type || '2+1') as '2+1'|'2+2';
    const rows = detail.seat_map?.rows ?? 12;

    const [qty,setQty]=useState(1);
    const [seats,setSeats]=useState<string[]>([]);
    const [passenger,setPassenger]=useState({ first_name:'', last_name:'', doc_type:'tc', national_id:'', passport_no:'', nationality:'TR', email:'', phone:'' });
    const [payment,setPayment]=useState({ card_holder:'', card_number:'', card_exp:'', card_cvv:'' });

    const taken = useMemo(()=> new Set(detail.taken_seats||[]),[detail.taken_seats]);
    const canSubmit = seats.length===qty
        && (passenger.doc_type==='tc' ? passenger.national_id.trim() : passenger.passport_no.trim())
        && passenger.first_name.trim() && passenger.last_name.trim()
        && (passenger.first_name + ' ' + passenger.last_name).trim().length>1
        && payment.card_number.replace(/\s+/g,'').length>=12
        && /\d{2}\/\d{2}/.test(payment.card_exp) && payment.card_cvv.length>=3;

    const submit = async ()=>{
        if (!canSubmit) return;
        const payload = {
            product_id: detail.id,
            qty,
            seats,
            passenger_name: `${passenger.first_name} ${passenger.last_name}`.trim(),
            passenger_doc_type: passenger.doc_type,
            passenger_national_id: passenger.doc_type==='tc' ? passenger.national_id : null,
            passenger_passport_no: passenger.doc_type==='passport' ? passenger.passport_no : null,
            passenger_nationality: passenger.doc_type==='passport' ? passenger.nationality : 'TR',
            passenger_email: passenger.email || null,
            passenger_phone: passenger.phone || null,
            card_holder: `${passenger.first_name} ${passenger.last_name}`.trim(),
            card_number: payment.card_number,
            card_exp: payment.card_exp,
            card_cvv: payment.card_cvv,
        };
        await onPurchase(payload);
    };

    const currency = useMemo(()=> new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}),[]);

    return (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 grid place-items-center">
            <div className="w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-2xl border bg-white">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">{detail.trip || `${detail.terminal_from} → ${detail.terminal_to}`}</div>
                        <div className="text-xs text-indigo-900/60">
                            {detail.company_name || '-'} • Kalkış {fmtTR(detail.departure_time)} • {detail.duration || '—'} • {detail.bus_type || '—'}
                        </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg border" onClick={onClose}>Kapat</button>
                </div>

                <div className="p-4 grid lg:grid-cols-[1.2fr_1fr] gap-4">
                    {/* Sol: Koltuk seçimi */}
                    <div className="space-y-4">
                        <section className="rounded-xl border p-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">Koltuk Seçimi</h3>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm">Adet</label>
                                    <select className="rounded-lg border px-2 py-1" value={qty}
                                            onChange={e=>{ const n=Number(e.target.value); setQty(n); setSeats(s=>s.slice(0,n)); }}>
                                        {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            </div>
                            <SeatMap rows={rows} layout={layout} taken={taken} selected={seats} onToggle={(s)=>{
                                if(taken.has(s)) return;
                                setSeats(curr=>{
                                    const has = curr.includes(s);
                                    let next = has ? curr.filter(x=>x!==s) : [...curr, s];
                                    if(next.length>qty) next = next.slice(0, qty);
                                    return next;
                                });
                            }}/>
                            <div className="mt-3 text-sm text-indigo-900/70">Seçilen: {seats.length ? seats.join(', ') : '—'}</div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Güzergâh Durakları</h3>
                            <div className="text-sm">
                                {(detail.route||[]).length
                                    ? <ul className="list-disc ml-5 space-y-1">{(detail.route||[]).map((s,i)=> <li key={i}>{s.name}{s.time?` • ${s.time}`:''}</li>)}</ul>
                                    : <div className="text-indigo-900/60">Bilgi yok</div>}
                            </div>
                        </section>

                        {(detail.important_notes || detail.cancellation_policy) && (
                            <section className="rounded-xl border p-3 text-sm">
                                {detail.important_notes && (<><div className="font-semibold mb-1">Önemli Notlar</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.important_notes}</div></>)}
                                {detail.cancellation_policy && (<><div className="font-semibold mt-2 mb-1">İptal/İade Koşulları</div><div className="text-indigo-900/70 whitespace-pre-wrap">{detail.cancellation_policy}</div></>)}
                            </section>
                        )}
                    </div>

                    {/* Sağ: Yolcu + Ödeme + Özet */}
                    <div className="space-y-4">
                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Yolcu Bilgileri</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Input label="Ad" value={passenger.first_name} onChange={v=>setPassenger(s=>({...s, first_name:v}))}/>
                                <Input label="Soyad" value={passenger.last_name} onChange={v=>setPassenger(s=>({...s, last_name:v}))}/>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                <Input label="E-posta" value={passenger.email} onChange={v=>setPassenger(s=>({...s, email:v}))}/>
                                <Input label="Telefon" value={passenger.phone} onChange={v=>setPassenger(s=>({...s, phone:v}))}/>
                            </div>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-sm text-indigo-900/70 mb-1">Belge</label>
                                    <select className="w-full rounded-lg border px-3 py-2" value={passenger.doc_type}
                                            onChange={e=>setPassenger(s=>({...s, doc_type:e.target.value as any}))}>
                                        <option value="tc">TC Kimlik</option>
                                        <option value="passport">Pasaport</option>
                                    </select>
                                </div>
                                {passenger.doc_type==='tc'
                                    ? (<Input label="TC Kimlik No" value={passenger.national_id} onChange={v=>setPassenger(s=>({...s, national_id:v}))}/>)
                                    : (<>
                                        <Input label="Pasaport No" value={passenger.passport_no} onChange={v=>setPassenger(s=>({...s, passport_no:v}))}/>
                                        <Input label="Uyruk" value={passenger.nationality} onChange={v=>setPassenger(s=>({...s, nationality:v}))}/>
                                    </>)
                                }
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Ödeme Bilgileri</h3>
                            <Input label="Kart Üzerindeki İsim" value={`${passenger.first_name} ${passenger.last_name}`.trim()} onChange={()=>{}} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                                <Input label="Kart Num." value={payment.card_number} onChange={v=>setPayment(s=>({...s, card_number:v}))} placeholder="**** **** **** ****"/>
                                <Input label="SKT (AA/YY)" value={payment.card_exp} onChange={v=>setPayment(s=>({...s, card_exp:v}))} placeholder="MM/YY"/>
                                <Input label="CVV" value={payment.card_cvv} onChange={v=>setPayment(s=>({...s, card_cvv:v}))}/>
                            </div>
                        </section>

                        <section className="rounded-xl border p-3">
                            <h3 className="font-semibold mb-2">Özet</h3>
                            <div className="text-sm grid grid-cols-2 gap-y-1">
                                <div className="text-indigo-900/60">Sefer</div><div>{detail.trip ?? '-'}</div>
                                <div className="text-indigo-900/60">Güzergâh</div><div>{detail.terminal_from} → {detail.terminal_to}</div>
                                <div className="text-indigo-900/60">Kalkış</div><div>{fmtTR(detail.departure_time)}</div>
                                <div className="text-indigo-900/60">Adet</div><div>{seats.length || 0}</div>
                                <div className="text-indigo-900/60">Koltuk</div><div>{seats.length ? seats.join(', ') : '—'}</div>
                                <div className="text-indigo-900/60">Tutar</div>
                                <div className="font-semibold">{currency.format(Number(detail.cost||0)*seats.length)}</div>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                                <button className="px-4 py-2 rounded-xl border" onClick={onClose}>Vazgeç</button>
                                <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                                        disabled={!canSubmit || submitting}
                                        onClick={submit}>
                                    {submitting? 'Gönderiliyor…' : 'Satın Al'}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Input({label,value,onChange,placeholder=''}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){
    return (
        <div>
            <label className="block text-sm text-indigo-900/70 mb-1">{label}</label>
            <input className="w-full rounded-lg border px-3 py-2" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
        </div>
    );
}

function SeatMap({
                     rows, layout, taken, selected, onToggle
                 }:{ rows:number; layout:'2+1'|'2+2'; taken:Set<string>; selected:string[]; onToggle:(s:string)=>void }){
    const leftCols = ['A','B'];
    const rightCols = layout==='2+1' ? ['C'] : ['C','D'];
    const isSel=(s:string)=> selected.includes(s);
    const isTaken=(s:string)=> taken.has(s);

    return (
        <div className="border rounded-xl p-3">
            <div className="mb-2 text-xs text-indigo-900/60">Düzen: {layout} • Sıra: {rows}</div>
            <div className="overflow-x-auto">
                <div className="inline-block">
                    <div className="flex items-center gap-3 mb-2 text-xs">
                        <LegendChip cls="bg-white" label="Boş" />
                        <LegendChip cls="bg-indigo-600 text-white" label="Seçili" />
                        <LegendChip cls="bg-gray-300" label="Dolu" />
                    </div>
                    <div className="space-y-1">
                        {Array.from({length: rows}).map((_,i)=>{
                            const r = i+1;
                            return (
                                <div key={r} className="flex items-center gap-2">
                                    <div className="flex gap-1">
                                        {leftCols.map(col=>{
                                            const code = `${r}${col}`;
                                            return <Seat key={code} code={code} selected={isSel(code)} taken={isTaken(code)} onClick={()=>onToggle(code)}/>;
                                        })}
                                    </div>
                                    <div className="w-6" />
                                    <div className="flex gap-1">
                                        {rightCols.map(col=>{
                                            const code = `${r}${col}`;
                                            return <Seat key={code} code={code} selected={isSel(code)} taken={isTaken(code)} onClick={()=>onToggle(code)}/>;
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
function Seat({ code, selected, taken, onClick }:{ code:string; selected:boolean; taken:boolean; onClick:()=>void }){
    const cls = taken ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
        : selected ? 'bg-indigo-600 text-white'
            : 'bg-white hover:bg-gray-50';
    return (
        <button type="button" className={`w-10 h-10 rounded-lg border text-xs font-medium ${cls}`} disabled={taken} onClick={onClick} title={code}>{code}</button>
    );
}
function LegendChip({cls,label}:{cls:string;label:string}){
    return (<div className="flex items-center gap-1"><div className={`w-4 h-4 rounded border ${cls}`} /><span>{label}</span></div>);
}
